# AGENTS.md — DevHub

Operational rules for coding agents. Product spec: `MASTER_PLAN.md` (load only the sections you need).

## Stack (pinned — see docs/decisions/0001-version-pins.md)

- pnpm 9.15.9 workspaces + Turborepo 2.11
- TypeScript 6.0.3 (not 7.x: typescript-eslint supports `<6.1`)
- Web: React 19.3 + Vite 8 + React Router 7 + Tailwind 4 + radix-ui + lucide-react (`apps/web`)
- Planned, not yet created: NestJS API, Prisma 7.10.1 + PostgreSQL, Tauri 2 desktop (Phase 3), Expo (Phase 8)

## Commands (run at repo root)

```bash
pnpm install
pnpm dev          # apps/web on Vite
pnpm typecheck
pnpm test         # design-token contrast gate
pnpm lint
pnpm build
pnpm format
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

## Layout

```text
apps/web/                    React + Vite app (shell + prototype)
  src/shell/                 Application Shell (see docs/design/APPLICATION_SHELL.md)
  src/nav.ts                 module list, groups, roadmap phase per module
packages/design-tokens/      tokens.ts → dist/tokens.css (see docs/design/DESIGN_TOKENS.md)
packages/typescript-config/  shared tsconfig presets
docs/                        product, architecture, design, decisions, security
references/                  prototypes and screenshots (read-only inputs)
```
