/** Boots the built API (dist/main.js) against a real, migrated PostgreSQL for one test file.
 *  Needs DATABASE_URL (from .env locally, from the job in CI). Files run one at a time
 *  (`--test-concurrency=1`) because they share the port. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { after, before } from 'node:test'
import { FAKE, FAKE_GITHUB_PORT, fakeGithub } from './fake-github.ts'
import { FAKE_PROVIDERS_PORT, fakeProviders } from './fake-providers.ts'

if (existsSync('.env')) process.loadEnvFile('.env')

const PORT = 3999
export const ORIGIN = 'http://localhost:5173'
export const BASE = `http://127.0.0.1:${PORT}/api`
export const PASSWORD = 'integration-test-password'

// Always the fake: the real GitHub credentials from .env must never be used by tests.
fakeGithub.listen(FAKE_GITHUB_PORT, '127.0.0.1')
const fakeBase = `http://127.0.0.1:${FAKE_GITHUB_PORT}`
fakeProviders.listen(FAKE_PROVIDERS_PORT, '127.0.0.1')
const providersBase = `http://127.0.0.1:${FAKE_PROVIDERS_PORT}`

const server = spawn(process.execPath, ['dist/main.js'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    WEB_ORIGIN: ORIGIN,
    // Monitor tests target a local server; the SSRF guard itself is unit-tested (ssrf.test.ts).
    MONITOR_ALLOW_PRIVATE: 'true',
    GITHUB_CLIENT_ID: FAKE.clientId,
    GITHUB_CLIENT_SECRET: FAKE.clientSecret,
    GITHUB_OAUTH_BASE: fakeBase,
    GITHUB_API_BASE: fakeBase,
    RENDER_API_BASE: providersBase,
    VERCEL_API_BASE: providersBase,
    NEON_API_BASE: providersBase,
    ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET || 'integration-test-secret-0123456789abcdef',
  },
  stdio: ['ignore', 'ignore', 'inherit'],
})

before(async () => {
  for (let i = 0; i < 50; i++) {
    const ok = await fetch(`${BASE}/health`).then(
      (r) => r.ok,
      () => false,
    )
    if (ok) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('API did not start')
})

after(() => {
  server.kill()
  fakeGithub.close()
  fakeProviders.close()
})

/** Signs up a fresh user and returns its session cookie. */
export async function signUp(label: string) {
  const res = await fetch(`${BASE}/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      name: label,
      email: `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@devhub.test`,
      password: PASSWORD,
    }),
  })
  assert.equal(res.status, 200)
  const cookie = res.headers.getSetCookie().find((c) => c.includes('session_token'))
  assert.ok(cookie, 'session cookie set')
  assert.match(cookie, /HttpOnly/i)
  return cookie.split(';')[0]!
}

/** Authenticated request as the web app would send it (same Origin, JSON body). */
export function api(cookie: string, method: string, path: string, body?: unknown) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      cookie,
      Origin: ORIGIN,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Runs the whole GitHub OAuth flow against the fake for this user. */
export async function connectGithub(cookie: string) {
  const start = await fetch(`${BASE}/integrations/github/connect`, {
    headers: { cookie },
    redirect: 'manual',
  })
  const state = new URL(start.headers.get('location')!).searchParams.get('state')!
  const stateCookie = start.headers
    .getSetCookie()
    .find((c) => c.startsWith('dh_gh_oauth='))!
    .split(';')[0]!
  const done = await fetch(
    `${BASE}/integrations/github/callback?${new URLSearchParams({ code: FAKE.code, state })}`,
    { headers: { cookie: `${cookie}; ${stateCookie}` }, redirect: 'manual' },
  )
  assert.match(done.headers.get('location')!, /github=connected$/)
}
