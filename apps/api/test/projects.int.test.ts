/** Projects API against the real database. Shares the server lifecycle in ./server.ts. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api, signUp } from './server.ts'

interface Project {
  id: string
  name: string
  description: string
  status: string
}

const create = (cookie: string, body: unknown) => api(cookie, 'POST', '/projects', body)

test('create, read, update and archive a project', async () => {
  const cookie = await signUp('pm')
  const created = await create(cookie, { name: '  DevHub  ', description: 'Painel' })
  assert.equal(created.status, 201)
  const p = (await created.json()) as Project
  assert.equal(p.name, 'DevHub')
  assert.equal(p.status, 'planning')

  const read = await api(cookie, 'GET', `/projects/${p.id}`)
  assert.equal(((await read.json()) as Project).description, 'Painel')

  const updated = await api(cookie, 'PATCH', `/projects/${p.id}`, { status: 'development' })
  assert.equal(((await updated.json()) as Project).status, 'development')

  await api(cookie, 'PATCH', `/projects/${p.id}`, { status: 'archived' })
  const archived = (await (await api(cookie, 'GET', '/projects?status=archived')).json()) as {
    items: Project[]
  }
  assert.deepEqual(
    archived.items.map((i) => i.id),
    [p.id],
  )
})

test('rejects invalid input and ignores unknown fields', async () => {
  const cookie = await signUp('pm-invalid')
  assert.equal((await create(cookie, { name: '' })).status, 400)
  assert.equal((await create(cookie, { name: 'x', status: 'shipped' })).status, 400)
  const res = await create(cookie, { name: 'Mass', workspaceId: 'someone-else', id: 'fixed' })
  assert.equal(res.status, 201)
  assert.notEqual(((await res.json()) as Project).id, 'fixed')
  assert.equal((await api(cookie, 'GET', '/projects/not-a-uuid')).status, 400)
})

test('duplicate names in one workspace conflict', async () => {
  const cookie = await signUp('pm-dup')
  assert.equal((await create(cookie, { name: 'Same' })).status, 201)
  assert.equal((await create(cookie, { name: 'Same' })).status, 409)
})

test('another user cannot read or change a project (IDOR)', async () => {
  const owner = await signUp('owner')
  const intruder = await signUp('intruder')
  const p = (await (await create(owner, { name: 'Private' })).json()) as Project
  assert.equal((await api(intruder, 'GET', `/projects/${p.id}`)).status, 404)
  assert.equal((await api(intruder, 'PATCH', `/projects/${p.id}`, { name: 'Pwned' })).status, 404)
  const list = (await (await api(intruder, 'GET', '/projects')).json()) as { items: Project[] }
  assert.equal(
    list.items.some((i) => i.id === p.id),
    false,
  )
})

test('pagination returns every project once', async () => {
  const cookie = await signUp('pm-pages')
  for (let i = 0; i < 5; i++) await create(cookie, { name: `P${i}` })
  const seen: string[] = []
  let cursor: string | null = null
  do {
    const qs: string = cursor ? `&cursor=${cursor}` : ''
    const page = (await (await api(cookie, 'GET', `/projects?limit=2${qs}`)).json()) as {
      items: Project[]
      nextCursor: string | null
    }
    assert.ok(page.items.length <= 2)
    seen.push(...page.items.map((i) => i.name))
    cursor = page.nextCursor
  } while (cursor)
  assert.deepEqual(seen.sort(), ['P0', 'P1', 'P2', 'P3', 'P4'])
})
