//! Phase 6, read only: Markdown files inside authorized folders (an Obsidian vault is one), and
//! the local AI inventory (Claude Code skills and sessions). Session files are counted, never read.

use serde::Serialize;
use std::{
    fs,
    path::{Component, Path, PathBuf},
    time::UNIX_EPOCH,
};

const MAX_FILES: usize = 2000;
const MAX_DEPTH: usize = 8;
const MAX_READ: u64 = 1024 * 1024;
const SKIP_DIRS: [&str; 6] = [
    "node_modules",
    "target",
    "dist",
    "build",
    ".git",
    ".obsidian",
];

#[derive(Serialize, Debug, PartialEq)]
pub struct DocFile {
    /// Path relative to the folder, with `/` separators.
    pub rel: String,
    pub size: u64,
    /// Unix milliseconds.
    pub modified: u64,
}

fn millis(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis() as u64)
}

/// Walks `dir` up to MAX_DEPTH, calling `visit` for every file. Symlinks are not followed.
fn walk(
    dir: &Path,
    depth: usize,
    skip_hidden: bool,
    visit: &mut dyn FnMut(&Path, &fs::Metadata) -> bool,
) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return true;
    };
    for entry in entries.flatten() {
        let Ok(meta) = fs::symlink_metadata(entry.path()) else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if meta.is_dir() {
            let hidden = skip_hidden && name.starts_with('.');
            if depth < MAX_DEPTH
                && !hidden
                && !SKIP_DIRS.contains(&name.as_str())
                && !walk(&entry.path(), depth + 1, skip_hidden, visit)
            {
                return false;
            }
        } else if meta.is_file() && !visit(&entry.path(), &meta) {
            return false;
        }
    }
    true
}

/// Markdown files under an authorized folder, newest first, capped at MAX_FILES.
pub fn docs_list(root: &str) -> Vec<DocFile> {
    let root = Path::new(root);
    let mut files = Vec::new();
    walk(root, 0, true, &mut |path, meta| {
        if path
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("md"))
        {
            if let Ok(rel) = path.strip_prefix(root) {
                files.push(DocFile {
                    rel: rel.to_string_lossy().replace('\\', "/"),
                    size: meta.len(),
                    modified: millis(meta),
                });
            }
        }
        files.len() < MAX_FILES
    });
    files.sort_by_key(|a| std::cmp::Reverse(a.modified));
    files
}

/// Resolves `rel` inside `root`; refuses absolute paths, `..`, and anything that escapes `root`
/// after resolving links.
pub fn confine(root: &str, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel.is_empty()
        || !rel_path
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
    {
        return Err("Caminho inválido".into());
    }
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let full =
        fs::canonicalize(root.join(rel_path)).map_err(|_| "Arquivo não encontrado".to_string())?;
    if !full.starts_with(&root) {
        return Err("Caminho fora da pasta autorizada".into());
    }
    Ok(full)
}

pub fn docs_read(root: &str, rel: &str) -> Result<String, String> {
    let path = confine(root, rel)?;
    if !path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("md"))
    {
        return Err("Apenas arquivos .md".into());
    }
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_READ {
        return Err("Arquivo maior que 1 MB".into());
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Skill {
    pub name: String,
    pub description: String,
    /// global (~/.claude/skills) | plugin (~/.claude/plugins/cache) | project (<folder>/.claude/skills)
    pub scope: &'static str,
    /// Plugin directory or project folder name.
    pub source: String,
    pub path: String,
}

/// `name:` and `description:` from a SKILL.md YAML front matter (single-line values only).
pub fn front_matter(text: &str) -> (Option<String>, Option<String>) {
    let mut lines = text.lines();
    if lines.next().map(str::trim) != Some("---") {
        return (None, None);
    }
    let (mut name, mut description) = (None, None);
    for line in lines.take_while(|l| l.trim() != "---") {
        let value = |k: &str| {
            line.strip_prefix(k)
                .map(|v| v.trim().trim_matches(|c| c == '"' || c == '\'').to_string())
        };
        if let Some(v) = value("name:") {
            name = Some(v);
        } else if let Some(v) = value("description:") {
            description = Some(v);
        }
    }
    (name, description)
}

fn skills_in(
    dir: &Path,
    scope: &'static str,
    source_of: &dyn Fn(&Path) -> String,
    out: &mut Vec<Skill>,
) {
    walk(dir, 0, false, &mut |path, meta| {
        if path.file_name().is_some_and(|n| n == "SKILL.md") && meta.len() <= MAX_READ {
            let text = fs::read_to_string(path).unwrap_or_default();
            let (name, description) = front_matter(&text);
            let folder = path
                .parent()
                .and_then(|p| p.file_name())
                .map(|n| n.to_string_lossy().into_owned());
            out.push(Skill {
                name: name.or(folder).unwrap_or_default(),
                description: description.unwrap_or_default().chars().take(300).collect(),
                scope,
                source: source_of(path),
                path: path.to_string_lossy().into_owned(),
            });
        }
        out.len() < MAX_FILES
    });
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SessionGroup {
    /// Claude Code's directory name for the project (its path with separators replaced).
    pub project: String,
    pub sessions: usize,
    pub bytes: u64,
    pub last_activity: u64,
}

#[derive(Serialize)]
pub struct Inventory {
    pub skills: Vec<Skill>,
    pub sessions: Vec<SessionGroup>,
}

fn home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

pub fn ai_inventory(folders: &[String]) -> Inventory {
    let mut skills = Vec::new();
    let mut sessions = Vec::new();
    if let Some(claude) = home().map(|h| h.join(".claude")) {
        skills_in(
            &claude.join("skills"),
            "global",
            &|_| "~/.claude/skills".into(),
            &mut skills,
        );
        let cache = claude.join("plugins").join("cache");
        // cache/<marketplace>/<plugin>/<version>/…/SKILL.md
        let plugin_of = |p: &Path| {
            let parts: Vec<_> = p
                .strip_prefix(&cache)
                .map(|r| {
                    r.components()
                        .map(|c| c.as_os_str().to_string_lossy().into_owned())
                        .collect()
                })
                .unwrap_or_default();
            parts.get(1..3).map(|s| s.join(" ")).unwrap_or_default()
        };
        skills_in(&cache, "plugin", &plugin_of, &mut skills);

        if let Ok(projects) = fs::read_dir(claude.join("projects")) {
            for dir in projects.flatten().filter(|d| d.path().is_dir()) {
                let mut group = SessionGroup {
                    project: dir.file_name().to_string_lossy().into_owned(),
                    sessions: 0,
                    bytes: 0,
                    last_activity: 0,
                };
                for f in fs::read_dir(dir.path()).into_iter().flatten().flatten() {
                    let Ok(meta) = f.metadata() else { continue };
                    if meta.is_file() && f.path().extension().is_some_and(|e| e == "jsonl") {
                        group.sessions += 1;
                        group.bytes += meta.len();
                        group.last_activity = group.last_activity.max(millis(&meta));
                    }
                }
                if group.sessions > 0 {
                    sessions.push(group);
                }
            }
        }
    }
    for folder in folders {
        let name = Path::new(folder)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        skills_in(
            &Path::new(folder).join(".claude").join("skills"),
            "project",
            &|_| name.clone(),
            &mut skills,
        );
    }
    sessions.sort_by_key(|a| std::cmp::Reverse(a.last_activity));
    Inventory { skills, sessions }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_single_line_front_matter() {
        let text =
            "---\nname: graphify\ndescription: \"Graphs: any input\"\n---\n# Body\nname: not this";
        assert_eq!(
            front_matter(text),
            (Some("graphify".into()), Some("Graphs: any input".into()))
        );
        assert_eq!(front_matter("# no front matter"), (None, None));
    }

    #[test]
    fn confines_paths_to_the_folder() {
        let root = std::env::temp_dir().join(format!("devhub-docs-{}", std::process::id()));
        fs::create_dir_all(root.join("notes")).unwrap();
        fs::write(root.join("notes").join("a.md"), "# A").unwrap();
        let r = root.to_str().unwrap();
        assert_eq!(docs_read(r, "notes/a.md").unwrap(), "# A");
        assert!(confine(r, "../outside.md").is_err());
        assert!(confine(r, "notes/../../x.md").is_err());
        assert!(confine(r, "C:\\Windows\\win.ini").is_err());
        assert!(confine(r, "").is_err());
        assert_eq!(docs_list(r)[0].rel, "notes/a.md");
        fs::remove_dir_all(&root).unwrap();
    }
}
