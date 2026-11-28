/** Phase 4 providers (Render, Vercel, Neon) against a local fake: key validation, encrypted
 *  storage, normalized resources, reconnect flow and workspace isolation. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GOOD_KEY, REVOKED_KEY, lastLogsQuery, revoked } from './fake-providers.ts'
import { api, signUp } from './server.ts'

const json = async <T>(res: Response) => (await res.json()) as T

test('providers: bad key refused, good key stored encrypted and never returned', async () => {
  const cookie = await signUp('prov')
  const bad = await api(cookie, 'PUT', '/providers/render', { token: 'wrong_key_123' })
  assert.equal(bad.status, 400)
  assert.equal((await json<{ code: string }>(bad)).code, 'invalid_key')
  assert.equal((await api(cookie, 'PUT', '/providers/render', { token: 'has space' })).status, 400)
  assert.equal((await api(cookie, 'PUT', '/providers/heroku', { token: GOOD_KEY })).status, 400)

  const ok = await api(cookie, 'PUT', '/providers/render', { token: GOOD_KEY })
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { provider: 'render', externalLogin: 'owner@example.test' })

  const list = await api(cookie, 'GET', '/providers')
  const text = await list.text()
  assert.ok(!text.includes(GOOD_KEY))
  const rows = JSON.parse(text) as { provider: string; integration: unknown }[]
  assert.deepEqual(
    rows.map((r) => [r.provider, r.integration !== null]),
    [
      ['render', true],
      ['vercel', false],
      ['neon', false],
    ],
  )
})

test('providers: normalized resources for each provider', async () => {
  const cookie = await signUp('prov-res')
  for (const p of ['render', 'vercel', 'neon']) {
    assert.deepEqual(await json(await api(cookie, 'GET', `/providers/${p}/resources`)), {
      provider: p,
      connected: false,
    })
    await api(cookie, 'PUT', `/providers/${p}`, { token: GOOD_KEY })
  }

  const render = await json<{
    services: { name: string; deploys: { sha: string; message: string }[] }[]
  }>(await api(cookie, 'GET', '/providers/render/resources'))
  assert.equal(render.services[0]!.name, 'devhub-api')
  assert.deepEqual(render.services[0]!.deploys[0]!.sha, 'abcdef1')
  assert.equal(render.services[0]!.deploys[0]!.message, 'Ship it')

  const vercel = await json<{ deployments: { url: string; state: string; ref: string }[] }>(
    await api(cookie, 'GET', '/providers/vercel/resources'),
  )
  assert.deepEqual(
    [vercel.deployments[0]!.url, vercel.deployments[0]!.state, vercel.deployments[0]!.ref],
    ['https://devhub-web-abc.vercel.app', 'READY', 'main'],
  )

  // Personal + organization projects, deduplicated.
  const neon = await json<{ projects: { id: string; branches: { isDefault: boolean }[] }[] }>(
    await api(cookie, 'GET', '/providers/neon/resources'),
  )
  assert.deepEqual(
    neon.projects.map((p) => p.id),
    ['p-1', 'p-2'],
  )
  assert.equal(neon.projects[0]!.branches[0]!.isDefault, true)

  // Isolation: another workspace sees nothing and cannot disconnect.
  const other = await signUp('prov-other')
  assert.equal(
    (await json<{ connected: boolean }>(await api(other, 'GET', '/providers/neon/resources')))
      .connected,
    false,
  )
  assert.equal((await api(other, 'DELETE', '/providers/neon')).status, 404)

  assert.equal((await api(cookie, 'DELETE', '/providers/neon')).status, 204)
  assert.equal((await api(cookie, 'DELETE', '/providers/neon')).status, 404)
})

test('providers: Render logs and metrics, Vercel build events', async () => {
  const cookie = await signUp('prov-detail')
  assert.deepEqual(await json(await api(cookie, 'GET', '/providers/render/services/srv-1/logs')), {
    provider: 'render',
    connected: false,
  })
  await api(cookie, 'PUT', '/providers/render', { token: GOOD_KEY })
  await api(cookie, 'PUT', '/providers/vercel', { token: GOOD_KEY })

  const logs = await json<{ lines: { id: string; level: string | null; text: string }[] }>(
    await api(cookie, 'GET', '/providers/render/services/srv-1/logs'),
  )
  assert.deepEqual(
    logs.lines.map((l) => [l.id, l.level]),
    [
      ['l1', null],
      ['l2', 'info'],
    ],
  )
  const q = new URLSearchParams(lastLogsQuery.value.split('?')[1])
  assert.deepEqual([q.get('ownerId'), q.get('resource')], ['tea-1', 'srv-1'])

  const metrics = await json<{
    cpu: { labels: Record<string, string> }[]
    memory: { unit: string; values: { value: number }[] }[]
    requests: unknown[]
  }>(await api(cookie, 'GET', '/providers/render/services/srv-1/metrics'))
  assert.equal(metrics.cpu[0]!.labels.instance, 'srv-1-a')
  assert.deepEqual(
    [metrics.memory[0]!.unit, metrics.memory[0]!.values[0]!.value],
    ['bytes', 1048576],
  )
  assert.deepEqual(metrics.requests, [])

  const events = await json<{ lines: { id: string; text: string }[] }>(
    await api(cookie, 'GET', '/providers/vercel/deployments/dpl_1/events'),
  )
  assert.deepEqual(
    events.lines.map((l) => [l.id, l.text]),
    [
      ['e1', 'vite build'],
      ['e2', 'Build ok'],
    ],
  )

  // A service the key cannot see is 404; a malformed id never reaches the provider.
  assert.equal((await api(cookie, 'GET', '/providers/render/services/srv-9/logs')).status, 404)
  assert.equal((await api(cookie, 'GET', '/providers/render/services/a.b/logs')).status, 400)
})

test('providers: a revoked key flips to needs_reconnect and notifies once', async () => {
  const cookie = await signUp('prov-revoke')
  revoked.on = false
  assert.equal((await api(cookie, 'PUT', '/providers/vercel', { token: REVOKED_KEY })).status, 200)
  revoked.on = true
  try {
    const [a, b] = await Promise.all([
      api(cookie, 'GET', '/providers/vercel/resources'),
      api(cookie, 'GET', '/providers/vercel/resources'),
    ])
    assert.deepEqual([a.status, b.status], [409, 409])
    assert.equal((await json<{ code: string }>(a)).code, 'provider_reconnect')
  } finally {
    revoked.on = false
  }
  const rows = await json<{ provider: string; integration: { status: string } | null }[]>(
    await api(cookie, 'GET', '/providers'),
  )
  assert.equal(rows.find((r) => r.provider === 'vercel')!.integration!.status, 'needs_reconnect')
  const inbox = await json<{ items: { title: string }[] }>(
    await api(cookie, 'GET', '/notifications'),
  )
  assert.equal(inbox.items.filter((n) => n.title === 'Vercel desconectado').length, 1)
})
