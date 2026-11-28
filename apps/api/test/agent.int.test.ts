/** Phase 5 Local Agent (ADR 0007): pairing, short-lived tokens, typed jobs claimed once,
 *  capability and folder checks, revocation and workspace isolation. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api, BASE, ORIGIN, signUp } from './server.ts'

const json = async <T>(res: Response) => (await res.json()) as T

/** The desktop agent: no cookies, bearer token, sends the DevHub origin. */
const agent = (token: string | null, method: string, path: string, body?: unknown) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

async function pairDevice(cookie: string) {
  const { code } = await json<{ code: string }>(await api(cookie, 'POST', '/devices/pairings'))
  const paired = await agent(null, 'POST', '/agent/pair', {
    code,
    name: 'Desktop',
    platform: 'windows',
  })
  assert.equal(paired.status, 201)
  const { deviceId, secret } = await json<{ deviceId: string; secret: string }>(paired)
  const { token } = await json<{ token: string }>(
    await agent(null, 'POST', '/agent/token', { deviceId, secret }),
  )
  return { code, deviceId, secret, token }
}

test('agent: pairing code is single use, secret trades for a token', async () => {
  const cookie = await signUp('agent-pair')
  const { code, deviceId, secret, token } = await pairDevice(cookie)
  const again = await agent(null, 'POST', '/agent/pair', { code, name: 'x', platform: 'y' })
  assert.equal(again.status, 400)
  assert.equal(
    (await agent(null, 'POST', '/agent/token', { deviceId, secret: 'x'.repeat(43) })).status,
    401,
  )
  assert.equal((await agent('bad.token.sig', 'GET', '/agent/jobs/next')).status, 401)
  assert.equal((await agent(token, 'GET', '/agent/jobs/next')).status, 204)

  const devices = await json<{ id: string; online: boolean; capabilities: string[] }[]>(
    await api(cookie, 'GET', '/devices'),
  )
  assert.equal(devices.length, 1)
  assert.equal(devices[0]!.online, true)
  assert.deepEqual(devices[0]!.capabilities, ['git.status', 'docker.listContainers', 'tools.list'])
  assert.ok(!JSON.stringify(devices).includes(secret))
})

test('agent: typed job claimed once, folder and capability checks, one result', async () => {
  const cookie = await signUp('agent-job')
  const { deviceId, token } = await pairDevice(cookie)
  const folder = { path: 'D:\\code\\app', name: 'app' }
  await agent(token, 'POST', '/agent/heartbeat', { folders: [folder] })

  const job = (body: unknown) => api(cookie, 'POST', `/devices/${deviceId}/jobs`, body)
  assert.equal((await job({ action: 'shell.exec', params: { cmd: 'rm' } })).status, 400)
  assert.equal((await job({ action: 'git.status', params: { path: 'C:\\Windows' } })).status, 400)
  const created = await job({ action: 'git.status', params: { path: folder.path } })
  assert.equal(created.status, 201)
  const { id } = await json<{ id: string }>(created)

  const [a, b] = await Promise.all([
    agent(token, 'GET', '/agent/jobs/next'),
    agent(token, 'GET', '/agent/jobs/next'),
  ])
  assert.deepEqual([a.status, b.status].sort(), [200, 204])
  const claimed = await json<{ id: string; action: string; params: unknown }>(
    a.status === 200 ? a : b,
  )
  assert.deepEqual(
    [claimed.id, claimed.action, claimed.params],
    [id, 'git.status', { path: folder.path }],
  )

  const done = await agent(token, 'POST', `/agent/jobs/${id}/result`, {
    ok: true,
    result: { branch: 'main' },
  })
  assert.equal(done.status, 204)
  const replay = await agent(token, 'POST', `/agent/jobs/${id}/result`, { ok: true, result: {} })
  assert.equal(replay.status, 409)
  const read = await json<{ status: string; result: unknown }>(
    await api(cookie, 'GET', `/devices/${deviceId}/jobs/${id}`),
  )
  assert.deepEqual([read.status, read.result], ['succeeded', { branch: 'main' }])

  // A disabled capability is refused on the server.
  assert.equal(
    (await api(cookie, 'PATCH', `/devices/${deviceId}`, { capabilities: ['tools.list'] })).status,
    204,
  )
  const off = await job({ action: 'docker.listContainers' })
  assert.equal(off.status, 409)
  assert.equal((await json<{ code: string }>(off)).code, 'capability_disabled')
})

test('agent: revocation and workspace isolation', async () => {
  const cookie = await signUp('agent-revoke')
  const { deviceId, secret, token } = await pairDevice(cookie)

  const other = await signUp('agent-other')
  assert.deepEqual(await json(await api(other, 'GET', '/devices')), [])
  assert.equal(
    (await api(other, 'POST', `/devices/${deviceId}/jobs`, { action: 'tools.list' })).status,
    404,
  )
  assert.equal((await api(other, 'DELETE', `/devices/${deviceId}`)).status, 404)

  assert.equal((await api(cookie, 'DELETE', `/devices/${deviceId}`)).status, 204)
  assert.equal((await agent(token, 'GET', '/agent/jobs/next')).status, 401)
  assert.equal((await agent(null, 'POST', '/agent/token', { deviceId, secret })).status, 401)
})
