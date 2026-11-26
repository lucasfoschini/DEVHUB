# DevHub

Developer Operating System — one workspace for projects, repositories, deployments, infrastructure and AI tooling.

Status: Phase 1 (foundation). See `ROADMAP.md`.

```bash
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env   # set BETTER_AUTH_SECRET
pnpm --filter @devhub/api db:migrate
pnpm dev                                 # http://localhost:5173
```

Requires Node >= 22.18 and pnpm 9.15.9.
