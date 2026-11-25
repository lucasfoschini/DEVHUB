# ADR 0001 — Version pins (2026-11-25)

## Context

Versions checked with `npm view` on 2026-11-25. Two `latest` tags were unsafe.

## Decision

| Tool         | Pin              | Reason                                                                                                                                       |
| ------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript   | 6.0.3            | 7.0.2 is `latest`, but typescript-eslint 8.74 peer is `<6.1.0`                                                                               |
| Prisma       | 7.10.1 (Phase 1) | npm `latest` tag points to `8.0.0-rc.35`                                                                                                     |
| pnpm         | 9.15.9           | Installed globally. pnpm 9 does not auto-switch to the `packageManager` version, and upgrading the global binary would affect other projects |
| Vite         | 8.3.8            | with @vitejs/plugin-react 6.3.0 (peer `vite ^8`)                                                                                             |
| React        | 19.3.1           |                                                                                                                                              |
| React Router | 7.18.7           | 8.5.3 needs Node >= 22.22; installed Node is 22.20                                                                                           |

## Revisit

- TypeScript 7 when typescript-eslint supports it.
- pnpm 10+ (blocks dependency build scripts by default) once the user upgrades the global pnpm.
- Prisma 8 when it ships stable.
- React Router 8 after Node is upgraded to >= 22.22.
