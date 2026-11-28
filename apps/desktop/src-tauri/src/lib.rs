//! DevHub desktop (Phase 3, docs/decisions/0006-desktop-tauri.md). The window shows the DevHub
//! web app from its own origin, so sessions stay first-party cookies. Only that origin gets IPC,
//! and only the typed commands below.

mod local;

use serde::Serialize;
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{
    ipc::CapabilityBuilder,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

/// The DevHub web origin, fixed at build time: `DEVHUB_URL=https://… pnpm desktop:build`.
const DEVHUB_URL: &str = match option_env!("DEVHUB_URL") {
    Some(url) => url,
    None => "http://localhost:5173",
};

const COMMANDS: [&str; 9] = [
    "folders_list",
    "folders_add",
    "folders_remove",
    "git_status",
    "open_in",
    "tools",
    "notify",
    "set_unread",
    "docker_containers",
];

/// Folders the user picked in the native dialog. Commands only act on these exact paths.
struct Folders {
    file: PathBuf,
    list: Mutex<Vec<String>>,
}

#[derive(Serialize)]
struct Folder {
    path: String,
    name: String,
}

impl Folders {
    fn load(file: PathBuf) -> Self {
        let list = fs::read_to_string(&file)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self {
            file,
            list: Mutex::new(list),
        }
    }

    fn snapshot(&self) -> Vec<Folder> {
        self.list
            .lock()
            .unwrap()
            .iter()
            .map(|p| Folder {
                name: PathBuf::from(p)
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| p.clone()),
                path: p.clone(),
            })
            .collect()
    }

    fn save(&self, list: &[String]) -> Result<(), String> {
        if let Some(dir) = self.file.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        fs::write(&self.file, serde_json::to_string(list).unwrap()).map_err(|e| e.to_string())
    }

    fn authorized(&self, path: &str) -> Result<(), String> {
        if self.list.lock().unwrap().iter().any(|p| p == path) {
            Ok(())
        } else {
            Err("Pasta não autorizada".into())
        }
    }
}

#[tauri::command]
fn folders_list(folders: State<Folders>) -> Vec<Folder> {
    folders.snapshot()
}

#[tauri::command]
async fn folders_add(app: AppHandle, folders: State<'_, Folders>) -> Result<Vec<Folder>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Autorizar pasta no DevHub")
        .blocking_pick_folder();
    if let Some(path) = picked.and_then(|p| p.into_path().ok()) {
        let path = path.to_string_lossy().into_owned();
        let mut list = folders.list.lock().unwrap().clone();
        if !list.contains(&path) {
            list.push(path);
            folders.save(&list)?;
            *folders.list.lock().unwrap() = list;
        }
    }
    Ok(folders.snapshot())
}

#[tauri::command]
fn folders_remove(path: String, folders: State<Folders>) -> Result<Vec<Folder>, String> {
    let list: Vec<String> = folders
        .list
        .lock()
        .unwrap()
        .iter()
        .filter(|p| **p != path)
        .cloned()
        .collect();
    folders.save(&list)?;
    *folders.list.lock().unwrap() = list;
    Ok(folders.snapshot())
}

#[tauri::command]
async fn git_status(path: String, folders: State<'_, Folders>) -> Result<local::GitStatus, String> {
    folders.authorized(&path)?;
    tauri::async_runtime::spawn_blocking(move || local::git_status(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_in(path: String, target: local::Target, folders: State<Folders>) -> Result<(), String> {
    folders.authorized(&path)?;
    local::open_in(&path, target)
}

#[tauri::command]
async fn tools() -> Result<Vec<local::Tool>, String> {
    tauri::async_runtime::spawn_blocking(local::tools)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn docker_containers() -> Result<Vec<local::Container>, String> {
    tauri::async_runtime::spawn_blocking(local::docker_containers)
        .await
        .map_err(|e| e.to_string())?
}

fn clip(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

#[tauri::command]
fn notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(clip(&title, 120))
        .body(clip(&body, 300))
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_unread(app: AppHandle, count: u32) {
    if let Some(tray) = app.tray_by_id("main") {
        let tip = match count {
            0 => "DevHub".to_string(),
            1 => "DevHub: 1 notificação não lida".to_string(),
            n => format!("DevHub: {n} notificações não lidas"),
        };
        let _ = tray.set_tooltip(Some(tip));
    }
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Ctrl+Shift+Space from anywhere: bring DevHub forward and open Spotlight. The web app listens
/// for the DOM event, so no event permission is granted to the page.
fn summon(app: &AppHandle) {
    show_main(app);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval("window.dispatchEvent(new CustomEvent('devhub:spotlight'))");
    }
}

/// GitHub's OAuth pages must load in the window so the callback reaches the same session.
fn stays_in_window(url: &Url, origin: &Url) -> bool {
    url.origin() == origin.origin()
        || (url.host_str() == Some("github.com")
            && ["/login", "/sessions"]
                .iter()
                .any(|p| url.path().starts_with(p)))
}

pub fn run() {
    let origin: Url = DEVHUB_URL
        .parse()
        .expect("DEVHUB_URL must be an absolute URL");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main(app)
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            folders_list,
            folders_add,
            folders_remove,
            git_status,
            open_in,
            tools,
            notify,
            set_unread,
            docker_containers
        ])
        .setup(move |app| {
            let data = app.path().app_data_dir()?;
            app.manage(Folders::load(data.join("folders.json")));

            let mut capability = CapabilityBuilder::new("devhub-origin")
                .window("main")
                .remote(format!("{}*", origin.as_str()))
                // In `tauri dev` the dev URL counts as local content.
                .local(cfg!(debug_assertions));
            for c in COMMANDS {
                capability = capability.permission(format!("allow-{}", c.replace('_', "-")));
            }
            app.add_capability(capability)?;

            let summon_key =
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, key, event| {
                        if key == &summon_key && event.state() == ShortcutState::Pressed {
                            summon(app);
                        }
                    })
                    .build(),
            )?;
            // Another app may own the combination; the desktop app still works without it.
            if let Err(e) = app.global_shortcut().register(summon_key) {
                eprintln!("global shortcut Ctrl+Shift+Space unavailable: {e}");
            }

            let handle = app.handle().clone();
            let popup_handle = app.handle().clone();
            let nav_origin = origin.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(origin.clone()))
                .title("DevHub")
                .inner_size(1280.0, 820.0)
                .min_inner_size(900.0, 600.0)
                .on_navigation(move |url| {
                    if stays_in_window(url, &nav_origin) {
                        return true;
                    }
                    // Everything else opens in the system browser, outside the IPC origin.
                    if matches!(url.scheme(), "http" | "https") {
                        let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                    }
                    false
                })
                // Links with target=_blank (GitHub, Render, Vercel…) open in the system browser.
                .on_new_window(move |url, _| {
                    if matches!(url.scheme(), "http" | "https") {
                        let _ = popup_handle.opener().open_url(url.as_str(), None::<&str>);
                    }
                    tauri::webview::NewWindowResponse::Deny
                })
                .build()?;

            let open = MenuItem::with_id(app, "open", "Abrir DevHub", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("DevHub")
                .menu(&Menu::with_items(app, &[&open, &quit])?)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = e
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        // Closing hides to the tray so notifications keep arriving; "Sair" in the tray quits.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running DevHub desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_devhub_and_github_oauth_stay_in_window() {
        let origin: Url = "http://localhost:5173".parse().unwrap();
        let ok = |u: &str| stays_in_window(&u.parse().unwrap(), &origin);
        assert!(ok("http://localhost:5173/git"));
        assert!(ok("https://github.com/login/oauth/authorize?x=1"));
        assert!(!ok("https://github.com/octo/repo"));
        assert!(!ok("http://localhost:3000/"));
        assert!(!ok("https://evil.example/"));
    }
}
