# 0006 — Desktop: Tauri window on the DevHub web origin

Date: 2026-11-26. Status: accepted.

## Context

Phase 3 adds the desktop app (MASTER_PLAN §05, §38). The web app talks to the API through relative `/api` paths and first-party session cookies (ADR 0003). Bundling the web build in Tauri would put it on `tauri.localhost`, a different site from the API, which would need cross-origin cookies or a second auth scheme.

## Decision

- `apps/desktop` (Tauri 2.12, Rust) opens one window on the DevHub web origin, fixed at build time by `DEVHUB_URL` (default `http://localhost:5173`). Sessions, CSRF checks and auth stay as they are. The desktop app keeps its own cookie jar, so the user signs in once in the app.
- IPC is granted to that origin only, through a capability built at runtime from `DEVHUB_URL`. App commands need explicit permissions (`build.rs`), and plugin commands are not exposed to JavaScript. Navigation to any other origin opens the system browser; GitHub's OAuth pages stay in the window so the callback reaches the same session.
- Typed commands: `folders_*` (folders picked in the native dialog, stored in the app data dir), `git_status` (porcelain v2 + last commit), `open_in` (Explorer, VS Code, Cursor, Windows Terminal), `tools` (installed versions), `notify`, `set_unread`.
- Tray with open/quit and an unread tooltip. Closing hides to the tray, and a second launch focuses the running instance. In the desktop app, the notification bell keeps polling while hidden and shows new unread items as OS notifications.
- The web app reaches the commands through the injected `window.__TAURI__` (`withGlobalTauri`), typed in `apps/web/src/desktop/bridge.ts`. No Tauri package in the web app.

## Consequences

- The desktop app needs a reachable DevHub web origin; without it the window shows the browser's connection error. A production build needs `DEVHUB_URL` set to the hosted web app.
- XSS on the DevHub origin would reach the local commands. They are limited to authorized folders and a closed set of programs, with no shell strings.
- Added 2026-11-27: a global Ctrl+Shift+Space (tauri-plugin-global-shortcut 2.4.1) shows the window and dispatches a `devhub:spotlight` DOM event, so the page gets no event permission. If another app owns the combination, the app runs without it. `docker_containers` lists local containers read only (`docker ps --all --format {{json .}}`). `pnpm --filter @devhub/desktop desktop:build` produces an unsigned NSIS installer.
- Not yet done: code signing (needs a certificate), verified updates (needs a signing key pair and a release host), and CI for the Rust crate (`cargo test` and `clippy` run locally).
