# 0008 — Local Markdown and AI inventory through the desktop app

Date: 2026-11-28. Status: accepted.

## Context

Phase 6 (MASTER_PLAN §7.7, §7.8) asks for Obsidian and local Markdown, a Skills Manager, sessions and per-project context. The user declined paid model keys, so model execution stays out. Obsidian has no API: a vault is a folder of Markdown files.

## Decision

- The desktop app reads, never writes. New commands, granted to the DevHub origin like the others (ADR 0006):
  - `docs_list {path}`: `.md` files under an authorized folder, up to 2000, depth 8, skipping hidden folders, `node_modules`, `target`, `dist`, `build`, `.git` and `.obsidian`. Symlinks are not followed.
  - `docs_read {path, rel}`: one `.md` file up to 1 MB. `rel` must be plain relative components, and the canonical path must stay inside the canonical folder.
  - `ai_inventory`: Claude Code skills from `~/.claude/skills` (global), `~/.claude/plugins/cache` (plugin) and `<authorized folder>/.claude/skills` (project), with `name` and `description` from the front matter. Also the number, size and last change of session files per project in `~/.claude/projects`. Session content is never opened.
- `tools` also reports Claude Code, Codex and Ollama, trying the `.exe` and then the `.cmd` shim on Windows.
- Knowledge Base shows the files and can import one as a note, which copies the text into the database. AI Center shows the inventory and flags skills that have several copies with the same name.

## Consequences

- Everything is local to the computer running the desktop app. The browser shows a hint instead. Remote access goes through the Local Agent (ADR 0007), which does not offer these reads yet.
- Imported notes do not follow later edits to the file. There is no write-back, conflict detection or backlink graph yet.
- Enabling or disabling skills is not offered: Claude Code has no supported switch for it outside its own settings.
