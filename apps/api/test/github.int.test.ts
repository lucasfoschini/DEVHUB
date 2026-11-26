/** GitHub OAuth flow against a local fake GitHub (./fake-github.ts). */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { FAKE, seen } from './fake-github.ts'
import { BASE, api, signUp } from './server.ts'

interface Status {
  configured: boolean
  integration: { externalLogin: string; scopes: string[]; status: string } | null
}

const status = async (cookie: string) =>
  (await (await api(cookie, 'GET', '/integrations/github')).json()) as Status

/** Starts the flow; returns the authorize URL and the state cookie the API set. */
async function connect(cookie: string, access = 'public') {
  const res = await fetch(`${BASE}/integrations/github/connect?access=${access}`, {
    headers: { cookie },
    redirect: 'manual',
  })
  assert.equal(res.status, 302)
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('dh_gh_oauth='))!
  assert.match(setCookie, /HttpOnly/i)
  assert.match(setCookie, /SameSite=Lax/i)
  return { authorize: new URL(res.headers.get('location')!), stateCookie: setCookie.split(';')[0]! }
}

function callback(cookie: string, stateCookie: string, params: Record<string, string>) {
  return fetch(`${BASE}/integrations/github/callback?${new URLSearchParams(params)}`, {
    headers: { cookie: `${cookie}; ${stateCookie}` },
    redirect: 'manual',
  })
}

test('authorize URL carries the chosen scopes, state and PKCE', async () => {
  const cookie = await signUp('gh-url')
  const pub = (await connect(cookie, 'public')).authorize
  assert.equal(pub.pathname, '/login/oauth/authorize')
  assert.equal(pub.searchParams.get('scope'), 'read:user')
  assert.equal(pub.searchParams.get('code_challenge_method'), 'S256')
  assert.ok((pub.searchParams.get('state') ?? '').length >= 40)
  const priv = (await connect(cookie, 'private')).authorize
  assert.equal(priv.searchParams.get('scope'), 'read:user repo')
  const bad = await fetch(`${BASE}/integrations/github/connect?access=admin`, {
    headers: { cookie },
    redirect: 'manual',
  })
  assert.equal(bad.status, 400)
})

test('a wrong state is refused and stores nothing', async () => {
  const cookie = await signUp('gh-state')
  const { stateCookie } = await connect(cookie)
  const res = await callback(cookie, stateCookie, { code: FAKE.code, state: 'forged' })
  assert.match(res.headers.get('location')!, /github=error$/)
  assert.equal((await status(cookie)).integration, null)
})

test('connect, then disconnect revokes the grant at GitHub', async () => {
  const cookie = await signUp('gh-ok')
  assert.equal((await status(cookie)).configured, true)
  const { authorize, stateCookie } = await connect(cookie)
  const res = await callback(cookie, stateCookie, {
    code: FAKE.code,
    state: authorize.searchParams.get('state')!,
  })
  assert.match(res.headers.get('location')!, /\/git\?github=connected$/)
  // The state cookie is cleared after use.
  assert.match(res.headers.getSetCookie().join(), /dh_gh_oauth=;.*Max-Age=0/)
  // PKCE: the verifier sent on exchange matches the challenge sent on authorize.
  const challenge = createHash('sha256').update(seen.verifier).digest('base64url')
  assert.equal(challenge, authorize.searchParams.get('code_challenge'))

  const connected = await status(cookie)
  assert.deepEqual(connected.integration, {
    ...connected.integration,
    externalLogin: 'octo',
    scopes: ['read:user'],
    status: 'connected',
  })
  // The token itself is never returned to the client.
  assert.ok(!JSON.stringify(connected).includes(FAKE.token))

  const other = await signUp('gh-other')
  assert.equal((await status(other)).integration, null)

  const del = await api(cookie, 'DELETE', '/integrations/github')
  assert.deepEqual(await del.json(), { revokedAtProvider: true })
  assert.ok(seen.revoked.includes(FAKE.token))
  assert.equal((await status(cookie)).integration, null)
})
