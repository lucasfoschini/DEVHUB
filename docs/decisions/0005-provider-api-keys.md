# 0005 — Render, Vercel and Neon through personal API keys

Date: 2026-11-26. Status: accepted.

## Context

Phase 4 needs a first deploy provider. The user deploys the front end on Vercel and back ends on Render, with PostgreSQL on Neon. Render and Neon offer no OAuth for third-party apps; Vercel offers OAuth only to registered Integrations, which needs a marketplace listing.

## Decision

- Connect each provider with an API key the user creates in the provider's dashboard and pastes in Settings. DevHub checks the key once (`whoami`), then stores it in the existing `Integration` table with the AES-256-GCM helper. No schema change.
- Read only: Render services and their last deploys, Vercel deployments, Neon projects (personal and per organization) and branches. Shown in Deployments (Render, Vercel) and Infrastructure (Neon).
- A 401/403 flips the integration to `needs_reconnect` and emits `integration.needs_reconnect` once, as GitHub does.
- No new dependency: plain `fetch` with a 10 s timeout and a 60 s cache.

## Consequences

- Keys can also write at the provider. DevHub never calls write endpoints, and the screen says so. Triggering deploys stays out of scope until there is an explicit, audited action design.
- Vercel team-scoped keys see only the personal scope for now (no `teamId`).
- Detail reads (added 2026-11-27): the last 100 Render log lines (`/v1/logs`, ownerId from the service), Render CPU, memory and HTTP request series for the last hour, and the last 100 lines of a Vercel deployment's build output (`/v3/deployments/:id/events`, `follow=0`). Same key, cache and reconnect path. Units are shown as Render returns them.
- Not covered: Vercel runtime logs, Neon consumption metrics, any write action.
