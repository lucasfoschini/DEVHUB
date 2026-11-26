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

## Phase 1 — Foundation (next)

API (NestJS), PostgreSQL + Prisma, authentication, workspace, CI. Starts with an ADR choosing the auth library. Module screens are Phase 2 (MVP).
