//! Local Agent (Phase 5, docs/decisions/0007-local-agent.md). The desktop app polls the DevHub API
//! for typed jobs over an outbound connection and answers them with the local commands. Nothing
//! listens on a port, and no job carries a command string.

use crate::{local, Folders};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

/// The only actions this agent runs, whatever the server sends.
const ALLOWLIST: [&str; 3] = ["git.status", "docker.listContainers", "tools.list"];
const POLL: Duration = Duration::from_secs(3);
const HEARTBEAT: Duration = Duration::from_secs(30);
const BACKOFF: Duration = Duration::from_secs(10);
const JOB_TIMEOUT: Duration = Duration::from_secs(20);
const KEYRING_SERVICE: &str = "dev.devhub.desktop";
const KEYRING_USER: &str = "local-agent";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Credentials {
    device_id: String,
    secret: String,
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

fn load() -> Option<Credentials> {
    let raw = entry().ok()?.get_password().ok()?;
    serde_json::from_str(&raw).ok()
}

fn forget() {
    if let Ok(e) = entry() {
        let _ = e.delete_credential();
    }
}

/// The running poll loop, if any. Setting the flag stops it at its next tick.
#[derive(Default)]
pub struct Agent {
    stop: Mutex<Option<Arc<AtomicBool>>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    paired: bool,
    device_id: Option<String>,
    running: bool,
}

pub fn status(agent: &Agent) -> Status {
    let creds = load();
    let running = agent
        .stop
        .lock()
        .unwrap()
        .as_ref()
        .is_some_and(|s| !s.load(Ordering::Relaxed));
    Status {
        paired: creds.is_some(),
        device_id: creds.map(|c| c.device_id),
        running,
    }
}

/// Checked again here after the server: the action must be on this agent's allowlist and among
/// the capabilities the server says the user enabled.
pub fn permitted(action: &str, capabilities: &[String]) -> Result<(), String> {
    if ALLOWLIST.contains(&action) && capabilities.iter().any(|c| c == action) {
        Ok(())
    } else {
        Err("Ação não permitida neste agente".into())
    }
}

struct Api {
    base: String,
    origin: String,
    http: reqwest::blocking::Client,
}

enum Failure {
    /// The device was revoked or the token expired.
    Unauthorized,
    Other(String),
}

impl Api {
    fn new(devhub_url: &str) -> Self {
        let url: tauri::Url = devhub_url
            .parse()
            .expect("DEVHUB_URL must be an absolute URL");
        Self {
            base: format!("{}/api", devhub_url.trim_end_matches('/')),
            // The API's CSRF check wants the web origin on writes; agent routes ignore cookies.
            origin: url.origin().ascii_serialization(),
            http: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .expect("HTTP client"),
        }
    }

    fn call(
        &self,
        method: &str,
        path: &str,
        token: Option<&str>,
        body: Option<Value>,
    ) -> Result<Option<Value>, Failure> {
        let url = format!("{}{}", self.base, path);
        let mut req = match method {
            "GET" => self.http.get(url),
            _ => self.http.post(url),
        }
        .header("Origin", &self.origin);
        if let Some(t) = token {
            req = req.bearer_auth(t);
        }
        if let Some(b) = body {
            req = req.json(&b);
        }
        let res = req.send().map_err(|e| Failure::Other(e.to_string()))?;
        match res.status().as_u16() {
            401 => Err(Failure::Unauthorized),
            204 => Ok(None),
            s if (200..300).contains(&s) => res
                .json()
                .map(Some)
                .map_err(|e| Failure::Other(e.to_string())),
            s => Err(Failure::Other(format!("HTTP {s}"))),
        }
    }
}

/// Claims a pairing code made by the signed-in page, stores the device secret and starts polling.
pub fn pair(app: &AppHandle, devhub_url: &str, code: &str) -> Result<(), String> {
    let api = Api::new(devhub_url);
    let name = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Computador".into());
    let body = json!({ "code": code, "name": name, "platform": std::env::consts::OS });
    let res = match api.call("POST", "/agent/pair", None, Some(body)) {
        Ok(Some(v)) => v,
        Ok(None) | Err(Failure::Unauthorized) => return Err("Resposta inesperada".into()),
        Err(Failure::Other(e)) if e == "HTTP 400" => {
            return Err("Código inválido ou expirado".into())
        }
        Err(Failure::Other(e)) => return Err(e),
    };
    let creds: Credentials = serde_json::from_value(res).map_err(|e| e.to_string())?;
    entry()?
        .set_password(&serde_json::to_string(&creds).unwrap())
        .map_err(|e| e.to_string())?;
    start(app, devhub_url);
    Ok(())
}

pub fn unpair(agent: &Agent) {
    if let Some(stop) = agent.stop.lock().unwrap().take() {
        stop.store(true, Ordering::Relaxed);
    }
    forget();
}

/// Starts the poll loop when the device is paired and no loop runs yet.
pub fn start(app: &AppHandle, devhub_url: &str) {
    let Some(creds) = load() else { return };
    let agent = app.state::<Agent>();
    let mut slot = agent.stop.lock().unwrap();
    if slot.as_ref().is_some_and(|s| !s.load(Ordering::Relaxed)) {
        return;
    }
    let stop = Arc::new(AtomicBool::new(false));
    *slot = Some(stop.clone());
    let app = app.clone();
    let api = Api::new(devhub_url);
    thread::spawn(move || run(app, api, creds, stop));
}

fn run(app: AppHandle, api: Api, creds: Credentials, stop: Arc<AtomicBool>) {
    let mut token: Option<(String, Instant)> = None;
    let mut last_beat: Option<Instant> = None;
    while !stop.load(Ordering::Relaxed) {
        match tick(&app, &api, &creds, &mut token, &mut last_beat) {
            Ok(()) => thread::sleep(POLL),
            Err(Failure::Unauthorized) if token.is_none() => {
                // The secret itself was refused: the device was revoked in Settings.
                forget();
                stop.store(true, Ordering::Relaxed);
            }
            Err(Failure::Unauthorized) => token = None,
            Err(Failure::Other(_)) => thread::sleep(BACKOFF),
        }
    }
}

fn tick(
    app: &AppHandle,
    api: &Api,
    creds: &Credentials,
    token: &mut Option<(String, Instant)>,
    last_beat: &mut Option<Instant>,
) -> Result<(), Failure> {
    if token
        .as_ref()
        .is_none_or(|(_, until)| Instant::now() + Duration::from_secs(60) > *until)
    {
        *token = None;
        let body = json!({ "deviceId": creds.device_id, "secret": creds.secret });
        let res = api
            .call("POST", "/agent/token", None, Some(body))?
            .unwrap_or_default();
        let t = res["token"]
            .as_str()
            .ok_or(Failure::Other("sem token".into()))?;
        // Server tokens last 10 minutes; refresh well before.
        *token = Some((t.to_string(), Instant::now() + Duration::from_secs(9 * 60)));
    }
    let t = token.as_ref().unwrap().0.clone();

    if last_beat.is_none_or(|at| at.elapsed() >= HEARTBEAT) {
        let folders = app.state::<Folders>().snapshot();
        api.call(
            "POST",
            "/agent/heartbeat",
            Some(&t),
            Some(json!({ "folders": folders })),
        )?;
        *last_beat = Some(Instant::now());
    }

    let Some(job) = api.call("GET", "/agent/jobs/next", Some(&t), None)? else {
        return Ok(());
    };
    let id = job["id"].as_str().unwrap_or_default().to_string();
    let body = match execute(app, &job) {
        Ok(result) => json!({ "ok": true, "result": result }),
        Err(error) => json!({ "ok": false, "error": error }),
    };
    api.call(
        "POST",
        &format!("/agent/jobs/{id}/result"),
        Some(&t),
        Some(body),
    )?;
    Ok(())
}

fn execute(app: &AppHandle, job: &Value) -> Result<Value, String> {
    let action = job["action"].as_str().unwrap_or_default().to_string();
    let capabilities: Vec<String> =
        serde_json::from_value(job["capabilities"].clone()).unwrap_or_default();
    permitted(&action, &capabilities)?;
    let path = job["params"]["path"].as_str().map(str::to_string);
    if action == "git.status" {
        app.state::<Folders>()
            .authorized(path.as_deref().unwrap_or_default())?;
    }
    with_timeout(move || match action.as_str() {
        "git.status" => local::git_status(&path.unwrap()).map(|s| json!(s)),
        "docker.listContainers" => local::docker_containers().map(|c| json!(c)),
        _ => Ok(json!(local::tools())),
    })
}

/// Local work runs on its own thread; a stuck tool is abandoned after JOB_TIMEOUT.
fn with_timeout(
    work: impl FnOnce() -> Result<Value, String> + Send + 'static,
) -> Result<Value, String> {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(work());
    });
    rx.recv_timeout(JOB_TIMEOUT)
        .map_err(|_| "Tempo esgotado".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runs_only_allowlisted_and_enabled_actions() {
        let caps = vec!["git.status".to_string(), "shell.exec".to_string()];
        assert!(permitted("git.status", &caps).is_ok());
        assert!(permitted("tools.list", &caps).is_err());
        assert!(permitted("shell.exec", &caps).is_err());
    }
}
