/** Integration test: boots the built API (dist/main.js) against a real, migrated PostgreSQL.
 *  Needs DATABASE_URL (from .env locally, from the job in CI). Run with `pnpm test:int`. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { after, before, test } from 'node:test'

if (existsSync('.env')) process.loadEnvFile('.env')

const PORT = 3999
const ORIGIN = 'http://localhost:5173'
const BASE = `http://127.0.0.1:${PORT}/api`
const PASSWORD = 'integration-test-password'

const server = spawn(process.execPath, ['dist/main.js'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    WEB_ORIGIN: ORIGIN,
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
})

/** Signs up a fresh user and returns its session cookie. */
async function signUp(label: string) {
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

const me = (cookie?: string) => fetch(`${BASE}/me`, { headers: cookie ? { cookie } : {} })

interface Me {
  user: { id: string }
  workspace: { id: string; role: string }
}
const meJson = async (cookie: string) => (await (await me(cookie)).json()) as Me

test('health reports the database', async () => {
  assert.deepEqual(await (await fetch(`${BASE}/health`)).json(), { status: 'ok', database: 'ok' })
})

test('/me requires a session', async () => {
  assert.equal((await me()).status, 401)
})

test('sign-up creates one personal workspace, stable across requests', async () => {
  const cookie = await signUp('alice')
  const first = await meJson(cookie)
  const second = await meJson(cookie)
  assert.equal(first.workspace.role, 'owner')
  assert.equal(first.workspace.id, second.workspace.id)
})

test('two users never share a workspace', async () => {
  const a = await meJson(await signUp('a'))
  const b = await meJson(await signUp('b'))
  assert.notEqual(a.user.id, b.user.id)
  assert.notEqual(a.workspace.id, b.workspace.id)
})

test('auth rejects a foreign origin', async () => {
  const res = await fetch(`${BASE}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    body: JSON.stringify({ email: 'x@devhub.test', password: PASSWORD }),
  })
  assert.equal(res.status, 403)
})

test('sign-out revokes the session server-side', async () => {
  const cookie = await signUp('carol')
  const res = await fetch(`${BASE}/auth/sign-out`, {
    method: 'POST',
    headers: { cookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: '{}',
  })
  assert.equal(res.status, 200)
  // Replaying the old cookie must fail: the session row is gone, not just the browser cookie.
  assert.equal((await me(cookie)).status, 401)
})
