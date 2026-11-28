# 0009 — Automation workflows and the `devhub` CLI

Date: 2026-11-28. Status: accepted.

## Context

Phase 7 (MASTER_PLAN §7.9, §05 CLI) asks for Trigger → Conditions → Actions workflows and a CLI. Automations so far were "event → webhook" (ADR 0004).

## Decision

### Workflows

- An automation has a trigger, an optional condition and one action, stored as columns on `Automation` (migration `automation_workflows`):
  - Triggers: the notification kinds, `schedule` (`intervalMinutes`, 5–1440) and `manual`.
  - Condition (event triggers only): text that must appear in the event's title or body, case-insensitive.
  - Actions: `webhook` (as before: SSRF guard, 3 attempts, history) or `notification` (an in-app notification).
  - `message` replaces the event title, or is the title of schedule and manual runs.
- The API applies the cross-field rules to the full record on every create and update (`normalize`). A webhook needs a URL, a schedule needs an interval, and fields that do not apply are cleared.
- Notifications created by an action have kind `automation`, which is not a trigger, so automations cannot fire each other (no loops).
- The existing 5-second worker also claims due schedules by moving `lastFiredAt` with `FOR UPDATE SKIP LOCKED`, so each interval fires once across instances. "Executar agora" (`POST /automations/:id/test`) runs the action at once: a labelled test for event triggers, a real run for schedule and manual ones.

### CLI

- `apps/cli` (`@devhub/cli`, bin `devhub`): TypeScript built with `tsc`, no runtime dependencies (Node 22 `fetch`, `readline`).
- `devhub login` signs in with Better Auth email and password through the web origin and stores the session cookie in `~/.devhub/config.json` (mode 0600). It is an ordinary session: Settings → Sessões lists and revokes it, and `devhub logout` signs out. The password comes from a hidden prompt or `--password-stdin`, never from an argument.
- Commands: `status`, `projects list|register`, `repos list|sync`, `monitor list`, `deploy status`, `agent status`, `doctor`, all with `--json`. Requests send the web origin, so the CSRF check is unchanged.

## Consequences

- No visual graph editor, variables, multi-step actions or cancellation yet. One action per automation covers the cases in §7.9 that exist today.
- No shared SDK package: the CLI declares the few response fields it reads. Extract one when a second client (mobile) needs the same contracts.
- The CLI session lasts as long as a web session (Better Auth defaults), not a short-lived token.
