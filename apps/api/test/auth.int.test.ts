/** Auth, session and workspace API against the real database (server in ./server.ts). */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BASE, ORIGIN, PASSWORD, signUp } from './server.ts'

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
