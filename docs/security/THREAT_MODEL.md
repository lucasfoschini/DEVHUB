# Threat model

Method: assets, trust boundaries, then STRIDE threats per boundary with the mitigation and the phase that must ship it. Architecture is in `docs/architecture/ARCHITECTURE.md`. Requirements come from `MASTER_PLAN.md` §08, §10 and §32.

Review this document whenever a new boundary appears (API in Phase 1, GitHub in Phase 2, desktop in Phase 3, local agent in Phase 5, AI in Phase 6).

## Assets

| Asset                                | Why it matters                                                         |
| ------------------------------------ | ---------------------------------------------------------------------- |
| DevHub session                       | Full access to the user's workspace.                                   |
| GitHub tokens (integration)          | Read access to private code; write access if scopes ever widen.        |
| Private repository data and metadata | Code, branch names, commit messages can hold secrets.                  |
| Monitor targets and results          | Internal URLs, uptime history.                                         |
| Audit log                            | Evidence of what happened; must not be editable by the actor.          |
| Local machine (Phase 5 agent)        | Filesystem, Git, Docker, editors. Highest impact asset in the product. |

## Trust boundaries

```text
 [B1] Browser ──HTTPS──▶ [B2] API ──▶ [B3] PostgreSQL
                          │
                          ├──▶ [B4] GitHub API / OAuth / webhooks
                          ├──▶ [B5] Monitored URLs (user-supplied)
                          └──◀── [B6] Local agent on the user's machine (Phase 5)
```

## Threats and mitigations

Phase column: when the mitigation must exist, at the latest.

### B1 → B2: browser to API (Phase 1)

| STRIDE | Threat                                            | Mitigation                                                                                                                                                                                         | Phase |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| S      | Session theft via XSS                             | `HttpOnly; Secure; SameSite=Lax` cookie; CSP without `unsafe-inline` scripts; React escaping; no `dangerouslySetInnerHTML` on remote data                                                          | 1     |
| S      | Credential stuffing, brute force on login         | Rate limit per account and per IP (correct `trust proxy`); delegate passwords to the auth library or OAuth only                                                                                    | 1     |
| T      | CSRF on state-changing routes                     | CSRF token or double-submit; reject unsafe methods without it; strict CORS allowlist                                                                                                               | 1     |
| R      | User denies an action                             | AuditLog row for every write: actor, workspace, action, target, time                                                                                                                               | 1     |
| I      | IDOR: reading another workspace's resource        | Every query scoped by `workspaceId` from the session, never from the request body; tests per endpoint                                                                                              | 1     |
| I      | Verbose errors leak stack traces or SQL           | Generic error body, details only in server logs                                                                                                                                                    | 1     |
| D      | Large payloads, unbounded lists                   | Body size limit, pagination with max page size, request timeouts                                                                                                                                   | 1     |
| E      | Mass assignment (`role`, `workspaceId` in body)   | DTO validation with an allowlist of fields (Zod or class-validator), never spread the body into Prisma                                                                                             | 1     |
| S      | Stolen session stays valid after the user notices | Done (2.7): Settings lists sessions (tokens never leave the API) and revokes any other one, scoped to the user; changing the password revokes every other session and re-issues the current cookie | 2     |

### B2 → B3: API to PostgreSQL (Phase 1)

| STRIDE | Threat                      | Mitigation                                                                                   | Phase  |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| T, I   | SQL injection               | Prisma queries only; any raw SQL uses tagged templates with parameters                       | 1      |
| I      | Database exposed to network | Bound to the Docker network / localhost; never a public port; credentials in env, not in git | 1      |
| T      | Audit log tampering         | App role has `INSERT`/`SELECT` only on AuditLog; no update/delete path in code               | 1      |
| I      | Backups leak data           | Encrypted backups, restore tested (before first production deploy)                           | Deploy |

### B2 ↔ B4: GitHub (Phase 2)

| STRIDE | Threat                               | Mitigation                                                                                                                                                                                                   | Phase |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| I      | Token leak from DB or logs           | Done: AES-256-GCM in `Integration.encryptedToken`, key only in `ENCRYPTION_KEY`; token never sent to the client; token exchange errors log only the provider error code                                      | 2     |
| E      | Over-broad scopes                    | OAuth Apps have no read-only private scope: the user picks `read:user` (public only) or `repo` (private, also allows writes), stated in the UI; granted scopes shown; disconnect revokes the grant at GitHub | 2     |
| S      | OAuth login CSRF / code injection    | Done: random `state` + PKCE S256 in an HttpOnly, SameSite=Lax, path-scoped, 10-minute cookie, compared in constant time; exact redirect URI                                                                  | 2     |
| S, T   | Forged or replayed webhooks          | Verify `X-Hub-Signature-256` with constant-time compare; dedupe by delivery id                                                                                                                               | 2     |
| D      | Rate limit exhaustion across clients | Cache and dedupe GitHub calls server-side; respect rate limit headers; incremental sync                                                                                                                      | 2     |

### B2 → B5: monitored URLs (Phase 2)

| STRIDE | Threat                                                               | Mitigation                                                                                                                                                                                                                                                                                                                                                 | Phase |
| ------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| I, E   | SSRF: monitor pointed at `localhost`, metadata IPs, internal network | Done (`apps/api/src/monitors/probe.ts`): IP checked inside the socket `lookup` (no DNS-rebinding window); IP-literal hosts checked separately because Node skips `lookup` for them; IPv4-mapped IPv6 included; each redirect hop (max 3) re-checked; `http`/`https` only, no credentials. `MONITOR_ALLOW_PRIVATE=true` turns it off for dev and tests only | 2     |
| D      | Slow or huge responses tie up the worker                             | Done: timeout 1–10 s, body never read, 5 concurrent checks, interval ≥ 60 s, 50 monitors per workspace, manual check at most every 10 s                                                                                                                                                                                                                    | 2     |
| I, E   | SSRF through automation webhooks                                     | Done: same guard as monitors (`probe.ts` with a POST body); redirects are not followed for POST; 5 s timeout, 5 concurrent deliveries, 3 attempts                                                                                                                                                                                                          | 7     |

### Secrets Vault (Phase 2+)

| STRIDE | Threat                                          | Mitigation                                                                                                                                                                              | Phase |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| I      | Secret values leak through lists, logs or audit | Done: values encrypted with AES-256-GCM (`ENCRYPTION_KEY`); queries never select `encryptedValue` except reveal; audit stores the name only; tests assert lists never contain the value | 2+    |
| R      | Who read a secret is unknown                    | Done: every reveal and copy is an audited `secret.reveal`; `lastRevealedAt` shown in the UI                                                                                             | 2+    |
| I      | Value left on screen                            | Done: a revealed value hides after 30 s                                                                                                                                                 | 2+    |

### B6: local agent (Phase 5) and desktop (Phase 3)

Highest risk in the product. Detailed design goes in `docs/security/AGENT_SECURITY.md` before any agent code.

| STRIDE | Threat                                          | Mitigation (from `MASTER_PLAN.md` §08, §32)                                                        | Phase |
| ------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----- |
| E      | Remote command execution through the agent      | Typed actions only (`git.status`, …), no shell strings; allowlist; check in API and again in agent | 5     |
| T      | Command injection, path traversal               | Arguments as arrays to `execFile`-style APIs; paths resolved and confined to authorized projects   | 5     |
| S      | Rogue device or stolen agent token              | Device pairing, per-device identity, short-lived tokens, revocation                                | 5     |
| T      | Replay of an authorized action                  | Nonce and expiry per request                                                                       | 5     |
| E      | Prompt injection makes AI trigger agent actions | AI output never bypasses authorization; sensitive actions need user confirmation                   | 5–6   |
| E      | Remote web content gains Tauri IPC              | Minimal capabilities, no IPC for remote origins, CSP, signed and verified updates                  | 3     |

### Supply chain (all phases)

| Threat                              | Mitigation                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Malicious or compromised dependency | Exact pins, lockfile committed, check version/license/maintenance before adding (`AGENTS.md`) |
| Vulnerable dependency               | `pnpm audit` in CI (Phase 1); review before upgrading                                         |
| Secret committed to git             | `.env*` ignored; secret scanning in CI (Phase 1)                                              |

## Out of scope for now

- Multi-tenant isolation between organizations (Phase 9).
- Billing and payment data (Phase 9).
- Insider threat at the hosting provider (hosting not chosen).

## Open decisions

- Auth library (ADR at Phase 1 start).
- Token encryption key storage: env-provided key for now, KMS when hosting is chosen.
- Hosting and its proxy topology, which defines `trust proxy` and rate limiting.
