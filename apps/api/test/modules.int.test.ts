/** Phase 4–7 modules: Secrets Vault, servers, notes, prompts, automations, deployments,
 *  analytics. Each checks the happy path, validation and workspace isolation. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { api, connectGithub, signUp } from './server.ts'

const json = async <T>(res: Response) => (await res.json()) as T

async function project(cookie: string, name = 'Proj') {
  return json<{ id: string }>(await api(cookie, 'POST', '/projects', { name }))
}

test('secrets: value only via audited reveal; unique per env; isolated', async () => {
  const cookie = await signUp('sec')
  const other = await signUp('sec-other')
  const p = await project(cookie)

  const created = await api(cookie, 'POST', '/secrets', {
    projectId: p.id,
    name: 'DATABASE_URL',
    environment: 'production',
    value: 'postgres://u:p@h/db',
  })
  assert.equal(created.status, 201)
  const s = await json<Record<string, unknown> & { id: string }>(created)
  assert.equal(s.encryptedValue, undefined)
  assert.equal(s.value, undefined)

  const dup = await api(cookie, 'POST', '/secrets', {
    projectId: p.id,
    name: 'DATABASE_URL',
    environment: 'production',
    value: 'x',
  })
  assert.equal(dup.status, 409)
  const bad = await api(cookie, 'POST', '/secrets', {
    projectId: p.id,
    name: 'lower-case',
    environment: 'production',
    value: 'x',
  })
  assert.equal(bad.status, 400)

  const list = await json<Record<string, unknown>[]>(await api(cookie, 'GET', '/secrets'))
  assert.equal(list.length, 1)
  assert.ok(!JSON.stringify(list).includes('postgres://'))

  const revealed = await api(cookie, 'POST', `/secrets/${s.id}/reveal`)
  assert.deepEqual(await revealed.json(), { value: 'postgres://u:p@h/db' })

  await api(cookie, 'PATCH', `/secrets/${s.id}`, { value: 'rotated' })
  assert.deepEqual(await (await api(cookie, 'POST', `/secrets/${s.id}/reveal`)).json(), {
    value: 'rotated',
  })

  // Isolation: other workspace cannot reveal, list or attach to the project.
  assert.equal((await api(other, 'POST', `/secrets/${s.id}/reveal`)).status, 404)
  assert.deepEqual(await (await api(other, 'GET', '/secrets')).json(), [])
  const foreign = await api(other, 'POST', '/secrets', {
    projectId: p.id,
    name: 'X',
    environment: 'development',
    value: 'x',
  })
  assert.equal(foreign.status, 422)
  assert.equal((await api(cookie, 'DELETE', `/secrets/${s.id}`)).status, 204)
})

test('servers, notes and prompts: CRUD, validation, isolation', async () => {
  const cookie = await signUp('crud')
  const other = await signUp('crud-other')

  const server = await api(cookie, 'POST', '/servers', {
    name: 'web-1',
    host: '203.0.113.10',
    environment: 'production',
  })
  assert.equal(server.status, 201)
  const sv = await json<{ id: string }>(server)
  assert.equal(
    (await api(cookie, 'POST', '/servers', { name: 'x', host: 'a b', environment: 'production' }))
      .status,
    400,
  )
  assert.equal((await api(other, 'PATCH', `/servers/${sv.id}`, { notes: 'x' })).status, 404)

  const note = await json<{ id: string }>(
    await api(cookie, 'POST', '/notes', { title: 'Runbook', body: '# Deploy\nPasso 1' }),
  )
  const found = await json<{ title: string }[]>(await api(cookie, 'GET', '/notes?q=passo'))
  assert.deepEqual(
    found.map((n) => n.title),
    ['Runbook'],
  )
  assert.equal((await api(other, 'GET', `/notes/${note.id}`)).status, 404)
  const full = await json<{ body: string }>(await api(cookie, 'GET', `/notes/${note.id}`))
  assert.equal(full.body, '# Deploy\nPasso 1')

  const prompt = await api(cookie, 'POST', '/prompts', {
    title: 'Revisar PR',
    body: 'Revise {{diff}}',
    tags: ['review'],
  })
  assert.equal(prompt.status, 201)
  assert.equal(
    (await api(cookie, 'POST', '/prompts', { title: 'Revisar PR', body: 'x' })).status,
    409,
  )
  assert.deepEqual(await (await api(other, 'GET', '/prompts')).json(), [])
})

let hook = ''
const received: string[] = []
const receiver = createServer(async (req, res) => {
  let raw = ''
  for await (const c of req) raw += c
  received.push(raw)
  res.writeHead(req.url === '/fail' ? 500 : 204)
  res.end()
})
before(async () => {
  await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', r))
  hook = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}`
})
after(() => {
  receiver.close()
})

test('automations: test delivery is recorded in the history', async () => {
  const cookie = await signUp('auto')
  const bad = await api(cookie, 'POST', '/automations', {
    name: 'x',
    trigger: 'monitor.down',
    url: 'ftp://example.com',
  })
  assert.equal(bad.status, 400)

  const a = await json<{ id: string }>(
    await api(cookie, 'POST', '/automations', {
      name: 'Slack',
      trigger: 'monitor.down',
      url: `${hook}/ok`,
      format: 'slack',
    }),
  )
  // The test delivery runs inline and returns the recorded outcome.
  const run = await json<{ status: string; statusCode: number | null }>(
    await api(cookie, 'POST', `/automations/${a.id}/test`),
  )
  assert.deepEqual([run.status, run.statusCode], ['succeeded', 204])
  const runs = await json<{ status: string }[]>(
    await api(cookie, 'GET', `/automations/${a.id}/runs`),
  )
  assert.equal(runs.length, 1)
  assert.ok(received.some((b) => b.includes('Teste do DevHub: Slack')))

  const other = await signUp('auto-other')
  assert.equal((await api(other, 'GET', `/automations/${a.id}/runs`)).status, 404)
})

test('deployments: read from GitHub for imported repositories', async () => {
  const cookie = await signUp('deploy')
  assert.deepEqual(await (await api(cookie, 'GET', '/deployments')).json(), {
    connected: false,
    pipelines: [],
  })
  await connectGithub(cookie)
  await api(cookie, 'POST', '/repositories', { externalId: '1002' })
  const res = await json<{
    connected: boolean
    pipelines: {
      runs: { workflow: string; conclusion: string; sha: string }[]
      deployments: { environment: string; state: string }[]
    }[]
  }>(await api(cookie, 'GET', '/deployments'))
  assert.equal(res.connected, true)
  assert.deepEqual(res.pipelines[0]!.runs[0], {
    ...res.pipelines[0]!.runs[0],
    workflow: 'CI',
    conclusion: 'success',
    sha: 'abcdef1',
  })
  assert.deepEqual(
    res.pipelines[0]!.deployments.map((d) => [d.environment, d.state]),
    [['production', 'success']],
  )
})

test('analytics: empty workspace has no invented values', async () => {
  const cookie = await signUp('analytics')
  const res = await json<{
    daily: unknown[]
    incidents: { opened: number; mttrSeconds: number | null }
    monitors: unknown[]
  }>(await api(cookie, 'GET', '/analytics?days=30'))
  assert.deepEqual(res.daily, [])
  assert.deepEqual(res.incidents, { opened: 0, resolved: 0, mttrSeconds: null })
  assert.equal((await api(cookie, 'GET', '/analytics?days=9')).status, 400)
})
