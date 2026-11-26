/** Notifications API: a monitor incident notifies once, read state, workspace isolation. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { api, signUp } from './server.ts'

interface Notification {
  id: string
  kind: string
  severity: string
  title: string
  body: string
  href: string | null
  readAt: string | null
}
interface List {
  items: Notification[]
  unread: number
}

let target = ''
const site = createServer((_req, res) => {
  res.writeHead(503)
  res.end()
})

before(async () => {
  await new Promise<void>((r) => site.listen(0, '127.0.0.1', r))
  target = `http://127.0.0.1:${(site.address() as AddressInfo).port}`
})

after(() => {
  site.close()
})

const list = async (cookie: string, query = '') =>
  (await (await api(cookie, 'GET', `/notifications${query}`)).json()) as List

test('an opened incident notifies once; read one, read all; other workspaces see nothing', async () => {
  const cookie = await signUp('notif')
  const other = await signUp('notif-other')
  assert.deepEqual(await list(cookie), { items: [], unread: 0 })

  const m = (await (
    await api(cookie, 'POST', '/monitors', { name: 'Loja', url: `${target}/` })
  ).json()) as { id: string }
  // Two consecutive failures open an incident (FAILURES_TO_OPEN); manual checks are 10 s apart.
  assert.equal((await api(cookie, 'POST', `/monitors/${m.id}/check`)).status, 201)
  assert.equal((await list(cookie)).unread, 0, 'one failure is not an incident')
  await new Promise((r) => setTimeout(r, 10_500))
  assert.equal((await api(cookie, 'POST', `/monitors/${m.id}/check`)).status, 201)

  const { items, unread } = await list(cookie)
  assert.equal(unread, 1)
  assert.deepEqual(
    { kind: items[0]!.kind, severity: items[0]!.severity, body: items[0]!.body },
    { kind: 'monitor.down', severity: 'critical', body: 'http_status' },
  )
  assert.equal(items[0]!.href, `/observability/${m.id}`)

  // Isolation: the other workspace neither sees nor can mark it.
  assert.deepEqual(await list(other), { items: [], unread: 0 })
  const foreign = await api(other, 'POST', `/notifications/${items[0]!.id}/read`)
  assert.deepEqual(await foreign.json(), { updated: 0 })
  assert.equal((await list(cookie)).unread, 1)

  const read = await api(cookie, 'POST', `/notifications/${items[0]!.id}/read`)
  assert.deepEqual(await read.json(), { updated: 1 })
  const after = await list(cookie)
  assert.equal(after.unread, 0)
  assert.ok(after.items[0]!.readAt)
  assert.deepEqual((await list(cookie, '?unread=true')).items, [])

  assert.deepEqual(await (await api(cookie, 'POST', '/notifications/read-all')).json(), {
    updated: 0,
  })
})

test('invalid id and query are rejected; unauthenticated is 401', async () => {
  const cookie = await signUp('notif-invalid')
  assert.equal((await api(cookie, 'POST', '/notifications/not-a-uuid/read')).status, 400)
  assert.equal((await api(cookie, 'GET', '/notifications?unread=yes')).status, 400)
  assert.equal((await api('', 'GET', '/notifications')).status, 401)
})
