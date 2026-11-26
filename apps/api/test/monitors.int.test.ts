/** Monitors API against the real database, checking a local target server. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { api, signUp } from './server.ts'

interface Check {
  ok: boolean
  statusCode: number | null
  error: string | null
}
interface Monitor {
  id: string
  name: string
  state: string
  project: { id: string } | null
  last24h: { checks: number; uptime: number | null; p50: number | null }
  recentChecks: Check[]
}

let target = ''
const site = createServer((req, res) => {
  res.writeHead(req.url === '/down' ? 503 : 200)
  res.end()
})

before(async () => {
  await new Promise<void>((r) => site.listen(0, '127.0.0.1', r))
  target = `http://127.0.0.1:${(site.address() as AddressInfo).port}`
})

after(() => {
  site.close()
})

test('create, check now, and read observed figures', async () => {
  const cookie = await signUp('mon')
  const created = await api(cookie, 'POST', '/monitors', { name: 'Site', url: `${target}/` })
  assert.equal(created.status, 201)
  const m = (await created.json()) as Monitor
  assert.equal(m.state, 'unknown')

  const check = (await (await api(cookie, 'POST', `/monitors/${m.id}/check`)).json()) as Check
  assert.equal(check.ok, true)
  assert.equal(check.statusCode, 200)

  // A second manual check right away is refused (cannot be used to flood a target).
  assert.equal((await api(cookie, 'POST', `/monitors/${m.id}/check`)).status, 409)

  const detail = (await (await api(cookie, 'GET', `/monitors/${m.id}`)).json()) as Monitor
  assert.equal(detail.state, 'up')
  assert.equal(detail.last24h.checks, 1)
  assert.equal(detail.last24h.uptime, 1)
  // One sample is not enough for a percentile: reported as null, not invented.
  assert.equal(detail.last24h.p50, null)
  assert.equal(detail.recentChecks.length, 1)
})

test('a failing endpoint is recorded as down with its status', async () => {
  const cookie = await signUp('mon-down')
  const m = (await (
    await api(cookie, 'POST', '/monitors', { name: 'Down', url: `${target}/down` })
  ).json()) as Monitor
  const check = (await (await api(cookie, 'POST', `/monitors/${m.id}/check`)).json()) as Check
  assert.deepEqual(
    { ok: check.ok, statusCode: check.statusCode, error: check.error },
    { ok: false, statusCode: 503, error: 'http_status' },
  )
  const detail = (await (await api(cookie, 'GET', `/monitors/${m.id}`)).json()) as Monitor
  assert.equal(detail.state, 'down')
})

test('validation: scheme, credentials, interval bounds', async () => {
  const cookie = await signUp('mon-invalid')
  const bad = [
    { name: 'a', url: 'file:///etc/passwd' },
    { name: 'b', url: 'http://user:pw@example.com' },
    { name: 'c', url: 'https://example.com', intervalSeconds: 5 },
    { name: 'd', url: 'https://example.com', timeoutMs: 60000 },
  ]
  for (const body of bad) {
    assert.equal((await api(cookie, 'POST', '/monitors', body)).status, 400, body.name)
  }
})

test('cannot link to, read, check or delete across workspaces', async () => {
  const owner = await signUp('mon-owner')
  const intruder = await signUp('mon-intruder')
  const project = (await (await api(owner, 'POST', '/projects', { name: 'P' })).json()) as {
    id: string
  }
  const m = (await (
    await api(owner, 'POST', '/monitors', { name: 'M', url: `${target}/`, projectId: project.id })
  ).json()) as Monitor
  assert.equal((m as unknown as { projectId: string }).projectId, project.id)

  assert.equal((await api(intruder, 'GET', `/monitors/${m.id}`)).status, 404)
  assert.equal((await api(intruder, 'POST', `/monitors/${m.id}/check`)).status, 404)
  assert.equal((await api(intruder, 'DELETE', `/monitors/${m.id}`)).status, 404)
  // Linking the intruder's monitor to the owner's project is refused.
  const res = await api(intruder, 'POST', '/monitors', {
    name: 'X',
    url: `${target}/`,
    projectId: project.id,
  })
  assert.equal(res.status, 422)

  assert.equal((await api(owner, 'DELETE', `/monitors/${m.id}`)).status, 204)
  assert.equal((await api(owner, 'GET', `/monitors/${m.id}`)).status, 404)
})
