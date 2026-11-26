# Roadmap

Phases and scope are defined in `MASTER_PLAN.md` §38–39. This file tracks status only.

## Phase 0 — Prototype foundation

| Step | Scope                                                                     | Status |
| ---- | ------------------------------------------------------------------------- | ------ |
| P0   | Monorepo, TS, lint, format, Vite app                                      | Done   |
| P1   | Graphite Lime tokens (dark, light, materials, motion) + contrast check    | Done   |
| P2   | Application Shell + adaptive sidebar + module routes                      | Done   |
| P3   | Contextual toolbar                                                        | Done   |
| P4   | Spotlight Search (Ctrl/Cmd+K)                                             | Done   |
| P5   | Control Center                                                            | Done   |
| P6   | Activity Shelf                                                            | Done   |
| P7   | Motion pass + reduced motion                                              | Done   |
| P8   | Accessibility, contrast and performance audit (`docs/design/UX_AUDIT.md`) | Done   |

Phase 0 docs: architecture and feasibility (`docs/architecture/ARCHITECTURE.md`), threat model (`docs/security/THREAT_MODEL.md`).

## Phase 1 — Foundation

| Step | Scope                                                                         | Status                       |
| ---- | ----------------------------------------------------------------------------- | ---------------------------- |
| 1.1  | Auth library ADR (`docs/decisions/0003-auth-better-auth.md`)                  | Done                         |
| 1.2  | `apps/api` (NestJS), PostgreSQL via Docker Compose, Prisma schema + migration | Done                         |
| 1.3  | Email/password auth, sessions, personal workspace, audit log                  | Done                         |
| 1.4  | Web sign-in, session gate, sign-out                                           | Done                         |
| 1.5  | CI (GitHub Actions): checks, API integration, web audit                       | Done (not yet run on GitHub) |

## Phase 2 — MVP (`MASTER_PLAN.md` §39)

| Step | Scope                                                                               | Status |
| ---- | ----------------------------------------------------------------------------------- | ------ |
| 2.1  | Projects: create, edit, archive, search, filter (API + screen)                      | Done   |
| 2.2  | GitHub integration (OAuth app, encrypted token, scope chosen by the user)           | Done   |
| 2.3  | Repository import and linking to projects                                           | Done   |
| 2.4  | HTTP monitors (SSRF guard, scheduler, history, incidents)                           | Done   |
| 2.5  | In-app notifications (monitor down/recovered, GitHub needs reconnect)               | Done   |
| 2.6  | Command Center with real data (`/api/overview`: monitors, incidents, projects, Git) | Done   |
| 2.7  | Settings: profile, password, sessions, notification preferences, integrations       | Done   |
