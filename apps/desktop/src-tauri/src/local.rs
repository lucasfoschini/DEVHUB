//! Local capabilities (Phase 3): folders the user authorized, Git status, opening a folder in a
//! tool. Every command takes a path the user picked earlier; nothing accepts a shell string.

use serde::Serialize;
use std::path::Path;
use std::process::{Command, Output};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// No console window flashes when the app runs a tool on Windows.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn command(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(program);
    #[cfg(windows)]
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

#[derive(Serialize, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub changed: u32,
    pub untracked: u32,
    pub conflicts: u32,
    pub last_commit: Option<Commit>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub sha: String,
    pub subject: String,
    pub date: String,
}

/// Parses `git status --porcelain=v2 --branch`.
pub fn parse_status(out: &str) -> GitStatus {
    let mut s = GitStatus {
        is_repo: true,
        ..Default::default()
    };
    for line in out.lines() {
        if let Some(head) = line.strip_prefix("# branch.head ") {
            s.branch = (head != "(detached)").then(|| head.to_string());
        } else if let Some(up) = line.strip_prefix("# branch.upstream ") {
            s.upstream = Some(up.to_string());
        } else if let Some(ab) = line.strip_prefix("# branch.ab ") {
            for part in ab.split(' ') {
                if let Some(n) = part.strip_prefix('+') {
                    s.ahead = n.parse().unwrap_or(0);
                } else if let Some(n) = part.strip_prefix('-') {
                    s.behind = n.parse().unwrap_or(0);
                }
            }
        } else if line.starts_with("1 ") || line.starts_with("2 ") {
            s.changed += 1;
        } else if line.starts_with("u ") {
            s.conflicts += 1;
        } else if line.starts_with("? ") {
            s.untracked += 1;
        }
    }
    s
}

fn git(path: &str, args: &[&str]) -> std::io::Result<Output> {
    command("git").arg("-C").arg(path).args(args).output()
}

// shortcut: no timeout on git; a huge or network-mounted repo can make one call slow. Add a
// timeout if users report hangs.
pub fn git_status(path: &str) -> Result<GitStatus, String> {
    let out = git(path, &["status", "--porcelain=v2", "--branch"])
        .map_err(|_| "Git não encontrado no PATH".to_string())?;
    if !out.status.success() {
        return Ok(GitStatus::default());
    }
    let mut status = parse_status(&String::from_utf8_lossy(&out.stdout));
    if let Ok(log) = git(path, &["log", "-1", "--format=%h%x1f%s%x1f%cI"]) {
        let text = String::from_utf8_lossy(&log.stdout);
        let mut parts = text.trim_end().splitn(3, '\u{1f}');
        if let (Some(sha), Some(subject), Some(date)) = (parts.next(), parts.next(), parts.next()) {
            status.last_commit = Some(Commit {
                sha: sha.into(),
                subject: subject.into(),
                date: date.into(),
            });
        }
    }
    Ok(status)
}

/// Where a folder can be opened. A closed set: the web side cannot name a program.
#[derive(serde::Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Target {
    Explorer,
    Vscode,
    Cursor,
    Terminal,
}

pub fn open_in(path: &str, target: Target) -> Result<(), String> {
    if !Path::new(path).is_dir() {
        return Err("A pasta não existe mais".into());
    }
    let mut c = match target {
        #[cfg(windows)]
        Target::Explorer => {
            let mut c = Command::new("explorer");
            c.arg(path);
            c
        }
        #[cfg(not(windows))]
        Target::Explorer => {
            let mut c = Command::new(if cfg!(target_os = "macos") {
                "open"
            } else {
                "xdg-open"
            });
            c.arg(path);
            c
        }
        Target::Vscode => {
            let mut c = command(if cfg!(windows) { "code.cmd" } else { "code" });
            c.arg(path);
            c
        }
        Target::Cursor => {
            let mut c = command(if cfg!(windows) {
                "cursor.cmd"
            } else {
                "cursor"
            });
            c.arg(path);
            c
        }
        #[cfg(windows)]
        Target::Terminal => {
            let mut c = Command::new("wt.exe");
            c.arg("-d").arg(path);
            c
        }
        #[cfg(not(windows))]
        Target::Terminal => return Err("Terminal ainda não suportado neste sistema".into()),
    };
    c.spawn()
        .map(|_| ())
        .map_err(|_| "Ferramenta não encontrada no PATH".into())
}

#[derive(Serialize)]
pub struct Tool {
    pub id: &'static str,
    pub label: &'static str,
    pub version: Option<String>,
}

/// Which developer tools are installed, by asking each for its version.
pub fn tools() -> Vec<Tool> {
    let probe: [(&str, &str, &str); 5] = [
        ("git", "Git", "git"),
        ("node", "Node.js", "node"),
        ("docker", "Docker", "docker"),
        (
            "vscode",
            "VS Code",
            if cfg!(windows) { "code.cmd" } else { "code" },
        ),
        (
            "cursor",
            "Cursor",
            if cfg!(windows) {
                "cursor.cmd"
            } else {
                "cursor"
            },
        ),
    ];
    probe
        .iter()
        .map(|(id, label, program)| Tool {
            id,
            label,
            version: command(program)
                .arg("--version")
                .output()
                .ok()
                .filter(|o| o.status.success())
                .and_then(|o| {
                    String::from_utf8_lossy(&o.stdout)
                        .lines()
                        .next()
                        .map(|l| l.trim().to_string())
                }),
        })
        .collect()
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Container {
    pub id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub ports: String,
}

/// One `docker ps --format "{{json .}}"` line per container; lines that do not parse are skipped.
pub fn parse_containers(out: &str) -> Vec<Container> {
    out.lines()
        .filter_map(|l| serde_json::from_str::<serde_json::Value>(l).ok())
        .map(|v| {
            let f = |k: &str| v[k].as_str().unwrap_or_default().to_string();
            Container {
                id: f("ID"),
                name: f("Names"),
                image: f("Image"),
                state: f("State"),
                status: f("Status"),
                ports: f("Ports"),
            }
        })
        .collect()
}

/// Local containers, read only. Fails with Docker's own message when the daemon is down.
pub fn docker_containers() -> Result<Vec<Container>, String> {
    let out = command("docker")
        .args(["ps", "--all", "--format", "{{json .}}"])
        .output()
        .map_err(|_| "Docker não está instalado".to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(err
            .lines()
            .next()
            .unwrap_or("Docker não respondeu")
            .to_string());
    }
    Ok(parse_containers(&String::from_utf8_lossy(&out.stdout)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_docker_ps_json_lines() {
        let out = concat!(
            r#"{"ID":"ab12","Names":"devhub-postgres-1","Image":"postgres:18","State":"running","Status":"Up 2 hours","Ports":"127.0.0.1:5433->5432/tcp"}"#,
            "\nnot json\n"
        );
        assert_eq!(
            parse_containers(out),
            vec![Container {
                id: "ab12".into(),
                name: "devhub-postgres-1".into(),
                image: "postgres:18".into(),
                state: "running".into(),
                status: "Up 2 hours".into(),
                ports: "127.0.0.1:5433->5432/tcp".into(),
            }]
        );
    }

    #[test]
    fn parses_branch_counts_and_detached() {
        let s = parse_status(
            "# branch.oid abc\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -1\n\
             1 .M N... 100644 100644 100644 a b src/a.ts\n2 R. N... 100644 100644 100644 a b R100 n\to\n\
             u UU N... 1 2 3 4 a b c x\n? new.txt\n? other.txt\n",
        );
        assert_eq!(s.branch.as_deref(), Some("main"));
        assert_eq!(s.upstream.as_deref(), Some("origin/main"));
        assert_eq!((s.ahead, s.behind), (2, 1));
        assert_eq!((s.changed, s.conflicts, s.untracked), (2, 1, 2));
        assert_eq!(parse_status("# branch.head (detached)\n").branch, None);
    }
}
