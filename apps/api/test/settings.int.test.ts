/** Settings: profile, password, sessions and notification preferences. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api, BASE, ORIGIN, PASSWORD, signUp } from './server.ts'

interface Session {
  id: string
  current: boolean
  token?: string
}

async function signIn(cookie: string, password = PASSWORD) {
  const me = (await (await api(cookie, 'GET', '/me')).json()) as { user: { email: string } }
  const res = await fetch(`${BASE}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: me.user.email, password }),
  })
  const c = res.headers.getSetCookie().find((x) => x.includes('session_token'))
  return { status: res.status, cookie: c?.split(';')[0] ?? '' }
}

test('profile name: update and validate', async () => {
  const cookie = await signUp('set-profile')
  assert.equal((await api(cookie, 'PATCH', '/me', { name: '  Novo nome ' })).status, 200)
  const me = (await (await api(cookie, 'GET', '/me')).json()) as { user: { name: string } }
  assert.equal(me.user.name, 'Novo nome')
  assert.equal((await api(cookie, 'PATCH', '/me', { name: '' })).status, 400)
})

test('sessions: listed without tokens; another can be revoked, the current cannot', async () => {
  const cookie = await signUp('set-sessions')
  const second = await signIn(cookie)
  assert.equal(second.status, 200)

  const list = (await (await api(cookie, 'GET', '/me/sessions')).json()) as Session[]
  assert.equal(list.length, 2)
  assert.ok(list.every((s) => s.token === undefined))
  const current = list.find((s) => s.current)!
  const other = list.find((s) => !s.current)!

  assert.equal((await api(cookie, 'DELETE', `/me/sessions/${current.id}`)).status, 404)
  assert.equal((await api(cookie, 'DELETE', `/me/sessions/${other.id}`)).status, 204)
  assert.equal((await api(second.cookie, 'GET', '/me')).status, 401)

  // Another user's session id is not found, not revoked.
  const stranger = await signUp('set-stranger')
  const theirs = (await (await api(stranger, 'GET', '/me/sessions')).json()) as Session[]
  assert.equal((await api(cookie, 'DELETE', `/me/sessions/${theirs[0]!.id}`)).status, 404)
  assert.equal((await api(stranger, 'GET', '/me')).status, 200)
})

test('password: wrong current is rejected; change signs out other sessions', async () => {
  const cookie = await signUp('set-password')
  const other = await signIn(cookie)
  const next = 'another-long-password-42'

  const wrong = await api(cookie, 'POST', '/me/password', {
    currentPassword: 'not-the-password',
    newPassword: next,
  })
  assert.equal(wrong.status, 400)
  const short = await api(cookie, 'POST', '/me/password', {
    currentPassword: PASSWORD,
    newPassword: 'short',
  })
  assert.equal(short.status, 400)

  const ok = await api(cookie, 'POST', '/me/password', {
    currentPassword: PASSWORD,
    newPassword: next,
  })
  assert.equal(ok.status, 204)
  assert.equal((await api(other.cookie, 'GET', '/me')).status, 401)
  // The caller gets a fresh session cookie and stays signed in.
  const renewed = ok.headers.getSetCookie().find((c) => c.includes('session_token'))
  assert.ok(renewed, 'new session cookie')
  assert.equal((await api(renewed.split(';')[0]!, 'GET', '/me')).status, 200)
  assert.equal((await signIn(renewed.split(';')[0]!, next)).status, 200)
})

test('notification preferences: mute a kind; unknown kinds rejected', async () => {
  const cookie = await signUp('set-notif')
  const initial = (await (await api(cookie, 'GET', '/notifications/preferences')).json()) as {
    kinds: string[]
    muted: string[]
  }
  assert.deepEqual(initial.muted, [])
  assert.ok(initial.kinds.includes('monitor.recovered'))

  const put = await api(cookie, 'PUT', '/notifications/preferences', {
    muted: ['monitor.recovered', 'monitor.recovered'],
  })
  assert.deepEqual(((await put.json()) as { muted: string[] }).muted, ['monitor.recovered'])
  const bad = await api(cookie, 'PUT', '/notifications/preferences', { muted: ['nope'] })
  assert.equal(bad.status, 400)
})
