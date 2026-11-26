# ADR 0003 — Authentication with Better Auth (2026-11-26)

## Context

`docs/architecture/ARCHITECTURE.md` requires server-side, revocable sessions in PostgreSQL with an `HttpOnly` cookie for the web, and OAuth Authorization Code + PKCE for desktop and mobile later. The API is NestJS 12 with Prisma 7.10.1. Installed Node is 22.20.

Candidates checked with `npm view` on 2026-11-26:

| Option                                         | Version                 | License | Notes                                                                                                       |
| ---------------------------------------------- | ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Better Auth                                    | 1.7.28                  | MIT     | DB sessions, email/password with scrypt, OAuth providers, Prisma adapter (peer `@prisma/client` ^7), active |
| `@thallesp/nestjs-better-auth`                 | 2.8.0                   | MIT     | NestJS wrapper. Requires Node ≥ 22.22.1, so not installable here                                            |
| Auth.js (`@auth/core`)                         | 0.41.3                  | ISC     | Still 0.x; built around framework integrations, no NestJS one                                               |
| Passport + express-session + connect-pg-simple | 0.7.0 / 1.19.0 / 10.0.0 | MIT     | Proven, but password hashing, account linking, rotation and CSRF are hand-written                           |

## Decision

- Use **Better Auth 1.7.28** with its Prisma adapter. Mount its handler on `/api/auth/*` in the Express instance under NestJS, without the wrapper package.
- Phase 1 sign-in: **email and password** only. No email sending yet, so no verification or reset by email; added with the email integration.
- GitHub is **not** a login method in Phase 1. It arrives in Phase 2 as an integration with its own token (see the threat model, boundary B4).
- Telemetry disabled explicitly in config.
- Session cookie: `HttpOnly`, `SameSite=Lax`, `Secure` outside localhost. Better Auth's origin check (`trustedOrigins`) guards state-changing auth routes; DevHub API routes add their own CSRF check.

## Consequences

- Better Auth owns the `User`, `Session`, `Account` and `Verification` tables. DevHub tables (`Workspace`, `Membership`, `AuditLog`) reference `User.id`.
- A NestJS guard reads the session through `auth.api.getSession` for DevHub routes.
- Desktop and mobile can use its OAuth/PKCE and Expo support later; that is re-evaluated in Phases 3 and 8.

## Revisit

- If Node is upgraded to ≥ 22.22.1, evaluate the NestJS wrapper.
- Before adding passkeys, 2FA or organizations plugins.
