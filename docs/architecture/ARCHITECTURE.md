# Architecture

Baseline decisions are in `MASTER_PLAN.md` §03–§10. This document states what exists, what Phase 1 adds, the boundaries between parts, and the feasibility risks. Security analysis is in `docs/security/THREAT_MODEL.md`.

## Current state (Phase 1 in progress, 2026-11-26)

| Part                         | Status                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/web`                   | Shell prototype behind sign-in. Module data is still simulated (`src/mocks`) and labelled.         |
| `apps/api`                   | NestJS: Better Auth (email/password), `/api/me` with personal workspace, `/api/health`, audit log. |
| `packages/design-tokens`     | Tokens → `tokens.css`, contrast gate in `pnpm test`.                                               |
| `packages/typescript-config` | Shared tsconfig presets.                                                                           |
| Database                     | PostgreSQL 18 via `docker-compose.yml` (127.0.0.1:5433), Prisma migrations in `apps/api/prisma`.   |
| CI                           | `.github/workflows/ci.yml`: checks, API integration against Postgres, web audit.                   |
| Desktop, agent, mobile, CLI  | Not created (Phases 3, 5, 8, 7).                                                                   |

## Target for Phase 1 (Foundation)

```text
 Browser (apps/web)                      GitHub (OAuth + REST API)
      │  HTTPS, HttpOnly session cookie        ▲
      ▼                                        │ server-side only, user token
 ┌──────────────────────────────────────────────┴───┐
 │ apps/api — NestJS modular monolith               │
 │  auth · workspaces · projects · integrations ·   │
 │  monitors (Phase 2) · notifications · audit      │
 └──────────────┬───────────────────────────────────┘
                │ Prisma (pooled connection)
                ▼
          PostgreSQL (Docker Compose in dev, never public)
```

Packages created only when they gain a second consumer:

| Package                    | Created when                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/contracts`       | Web needs the API's request/response types (Phase 1, first endpoint).                      |
| `packages/database`        | A second app (worker or agent) needs the Prisma client. Until then it lives in `apps/api`. |
| `packages/ui`, `app-shell` | Desktop (Phase 3) reuses the web shell.                                                    |

### Boundaries

- Clients never reach PostgreSQL, Redis or third-party APIs with privileged credentials. Every external call with a user token runs in the API.
- The API checks workspace membership and resource ownership on every request. The client hides what it cannot do but is never the check.
- DevHub login and GitHub authorization are separate. A user signs in to DevHub, then connects GitHub as an integration with its own token, scopes and revocation.
- Business rules live in API modules, not in React components.

### Authentication strategy

- **Web:** server-side sessions in PostgreSQL, cookie `HttpOnly; Secure; SameSite=Lax`, CSRF token on state-changing requests, revocable from Settings.
- **Desktop and mobile (Phases 3, 8):** OAuth 2.0 Authorization Code + PKCE through the system browser, tokens in OS secure storage, no client secret in the binary.
- **Library:** chosen in an ADR at the start of Phase 1, verified against these requirements (version, license, maintenance, support for PostgreSQL sessions and PKCE). No library is assumed here.

### Initial data model (Phases 1–2)

Only entities the MVP (`MASTER_PLAN.md` §39) needs. All rows carry `createdAt`/`updatedAt` in UTC.

| Entity                           | Purpose                                                  | Phase |
| -------------------------------- | -------------------------------------------------------- | ----- |
| User, Session, Account           | Identity, revocable sessions, linked login providers     | 1     |
| Workspace, Membership            | Isolation boundary; role `owner` only in the MVP         | 1     |
| AuditLog                         | Who did what, in which workspace; append-only            | 1     |
| Project                          | Unique name per workspace                                | 2     |
| Integration, CredentialReference | Connected provider and a pointer to its encrypted token  | 2     |
| Repository, ProjectRepository    | Imported repos (external id), many-to-many with projects | 2     |
| Monitor, MonitorCheck, Incident  | HTTP checks and their history                            | 2     |
| Notification, ActivityEvent      | In-app alerts and the activity feed                      | 2     |

Every workspace-owned table has `workspaceId` with a foreign key and an index, and queries filter by it. Row-level security in PostgreSQL is evaluated in Phase 9 (SaaS); until then there is one personal workspace per user.

### Integrations

Adapters behind narrow contracts (`GitProvider` first, read-only). Each adapter reports status, scopes, last sync and errors, and uses timeouts and retry with backoff. Webhooks are verified by signature and deduplicated by delivery id. Details in `docs/integrations/` when the first adapter lands.

## Feasibility

| Item              | Finding (2026-11-26)                                      | Impact                                                             |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| Node              | 22.20 installed. React Router 8 needs ≥ 22.22 (ADR 0001). | Stay on React Router 7 or upgrade Node.                            |
| Docker            | 29.9 installed.                                           | PostgreSQL via Docker Compose in Phase 1 is viable.                |
| PostgreSQL client | `psql` 18 installed.                                      | Local inspection possible.                                         |
| Rust / MSVC       | Not installed.                                            | Blocks Tauri (Phase 3) only.                                       |
| GitHub CLI        | Not installed. No `.github/workflows` yet.                | CI in Phase 1 is written by hand; verify on first push.            |
| Team size         | One developer.                                            | Monolith, no microservices, no Redis/BullMQ until a measured need. |
| Hosting           | Not chosen. Criteria in `MASTER_PLAN.md` §35.             | Decide by ADR before the first deploy, not in Phase 1.             |

### Main risks

1. **Scope.** The plan spans nine phases and seven apps. Mitigation: vertical slices, one module at a time, nothing created without a consumer.
2. **Credential handling.** GitHub tokens and, later, a local agent with machine access. Mitigation: threat model before code; tokens encrypted at rest and only in the API.
3. **Visual ambition vs. performance.** Glass and motion on low-end machines. Mitigation: glass budget and reduced-transparency path enforced by the P8 audit.
4. **Pinned toolchain drift.** TypeScript 6 and React Router 7 pins (ADR 0001). Mitigation: revisit list in the ADR.
