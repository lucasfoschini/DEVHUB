# AGENTS.md — DevHub

Operational rules for coding agents. Product spec: `MASTER_PLAN.md` (load only the sections you need).

## Stack (pinned — see docs/decisions/0001-version-pins.md)

- pnpm 9.15.9 workspaces + Turborepo 2.11
- TypeScript 6.0.3 (not 7.x: typescript-eslint supports `<6.1`)
- Web: React 19.3 + Vite 8 + React Router 7 + Tailwind 4 + radix-ui + cmdk + lucide-react (`apps/web`)
- API: NestJS 12 (ESM, built with `tsc`; `@nestjs/cli` needs a newer Node) + Prisma 7.10.1 + PostgreSQL 18 + Better Auth 1.7 (`apps/api`, ADR 0003)
- Desktop: Tauri 2.12 + Rust (`apps/desktop`, ADR 0006); loads the web app from `DEVHUB_URL`
- Planned, not yet created: Expo (Phase 8)

## Commands (run at repo root)

```bash
pnpm install
docker compose up -d                    # PostgreSQL on 127.0.0.1:5433
cp apps/api/.env.example apps/api/.env  # then set BETTER_AUTH_SECRET
pnpm --filter @devhub/api db:migrate    # apply migrations
pnpm dev          # web on :5173 (proxies /api) + API on :3000
pnpm typecheck
pnpm test         # contrast gate, activity store, API unit tests
pnpm --filter @devhub/api test:int     # API against the real database
pnpm --filter @devhub/web test:e2e   # P8 audit: axe, glass budget, screenshots (installed Chrome)
pnpm lint
pnpm build
pnpm format
pnpm desktop:dev                        # Tauri window on the running web app (needs pnpm dev)
pnpm --filter @devhub/desktop desktop:test   # Rust unit tests
pnpm --filter @devhub/cli build && node apps/cli/dist/cli.js help   # devhub CLI
```

A change is not done until `typecheck`, `lint`, `test`, `format:check` and `build` pass.

## Rules

- Create an app or package only when it has a concrete consumer.
- Do not add a dependency without checking version, license, and overlap with existing ones.
- Glass materials only on the navigation/interaction layer. Data and technical content use solid surfaces.
- Style only with token utilities (`bg-surface`, `text-secondary`…). No raw hex in components.
- Simulated data lives in `apps/web/src/mocks` and is visibly labelled "Simulado" in the UI.
- Never fake progress percentages, metrics, integrations, or test results.
- No destructive git or remote operations without explicit user approval.
- Do not copy Apple assets (SF Pro, SF Symbols, window chrome). Use Geist, JetBrains Mono, Lucide.
- Record architecture changes as an ADR in `docs/decisions/`.
- Every workspace-owned query filters by the session's workspace on the server (THREAT_MODEL.md).
- Schema changes go through `prisma migrate dev`; never edit an applied migration.

## Layout

```text
apps/api/                    NestJS API: auth, workspaces, audit (prisma/ holds schema + migrations)
apps/cli/                    devhub CLI (ADR 0009): session in ~/.devhub, talks to the web origin
apps/desktop/                Tauri 2 shell (src-tauri/: Rust commands, tray, runtime capability)
apps/web/                    React + Vite app (shell + prototype)
  src/shell/                 Application Shell (see docs/design/APPLICATION_SHELL.md)
  src/nav.ts                 module list, groups, roadmap phase per module
packages/design-tokens/      tokens.ts → dist/tokens.css (see docs/design/DESIGN_TOKENS.md)
packages/typescript-config/  shared tsconfig presets
docs/                        product, architecture, design, decisions, security
references/                  prototypes and screenshots (read-only inputs)
```
