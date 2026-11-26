# 0004 — Post-MVP modules without new dependencies

Date: 2026-11-26. Status: accepted.

## Context

The user asked for every remaining module screen. Phases 3 and 5 need Tauri (Rust + MSVC), which is not installed here. Other modules need providers DevHub has no credentials for (deploy platforms, model APIs). AGENTS.md forbids faking integrations, metrics or progress.

## Decision

Build each remaining web module on data DevHub really has, with no new dependency:

- **Deployments** read GitHub Actions runs and GitHub Deployments through the existing GitHub integration (read-only, cached 60 s).
- **Infrastructure** is an inventory the user enters. Reachability comes from HTTP monitors on the same project; no CPU or disk figures until the Local Agent exists.
- **Secrets Vault** reuses the AES-256-GCM helper. `ENCRYPTION_KEY` is now read at the top level of the config, so the vault works without GitHub.
- **Automations** use an outbox: `notify()` inserts `AutomationRun` rows in the same transaction as the notification; a worker claims them with `FOR UPDATE SKIP LOCKED` and posts with the monitor SSRF guard. "Test" delivers inline so the user sees the outcome immediately.
- **Knowledge Base** renders a Markdown subset with an in-house parser to a plain tree rendered by React. No HTML is ever injected, so no sanitizer dependency is needed.
- **Analytics** aggregates monitor checks and incidents in SQL; charts are hand-written SVG (one series each, token colours, table view, tooltip).
- **AI Center** starts as a prompt library with variables. Running prompts waits for a provider key and the AI gateway.

## Consequences

- Every screen shows real data or an honest empty state; the roadmap marks what is partial or blocked.
- Several API instances sharing a database must share configuration: a worker with a different `MONITOR_ALLOW_PRIVATE` would deliver queued webhooks with different rules.
- Replacing the Markdown parser with a library later is local to `apps/web/src/knowledge/`.
