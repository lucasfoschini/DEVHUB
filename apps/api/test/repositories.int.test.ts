/** Repository import and project linking, reading from the fake GitHub. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api, connectGithub, signUp } from './server.ts'

interface Repo {
  id: string
  fullName: string
  private: boolean
  defaultBranch: string
  projects: { project: { id: string; name: string } }[]
}

test('import needs a GitHub connection', async () => {
  const cookie = await signUp('repo-none')
  const res = await api(cookie, 'GET', '/github/repos')
  assert.equal(res.status, 409)
  assert.equal(((await res.json()) as { code: string }).code, 'github_reconnect')
})

test('list available, import with metadata from GitHub, link to a project', async () => {
  const cookie = await signUp('repo-ok')
  await connectGithub(cookie)

  const available = (await (await api(cookie, 'GET', '/github/repos')).json()) as {
    items: { externalId: string; fullName: string; importedId: string | null }[]
    nextPage: number | null
  }
  assert.deepEqual(
    available.items.map((r) => r.fullName),
    ['octo/public-app', 'octo/private-api'],
  )
  assert.equal(available.nextPage, null)

  // Client-sent metadata is ignored: only the id is accepted, the rest comes from GitHub.
  const imported = await api(cookie, 'POST', '/repositories', {
    externalId: '1002',
    fullName: 'evil/forged',
    private: false,
  })
  assert.equal(imported.status, 201)
  const repo = (await imported.json()) as Repo
  assert.equal(repo.fullName, 'octo/private-api')
  assert.equal(repo.private, true)

  // Importing again updates instead of duplicating.
  await api(cookie, 'POST', '/repositories', { externalId: '1002' })
  const list = (await (await api(cookie, 'GET', '/repositories')).json()) as Repo[]
  assert.equal(list.length, 1)

  const after = (await (await api(cookie, 'GET', '/github/repos')).json()) as {
    items: { externalId: string; importedId: string | null }[]
  }
  assert.equal(after.items.find((r) => r.externalId === '1002')?.importedId, repo.id)

  const project = (await (await api(cookie, 'POST', '/projects', { name: 'API' })).json()) as {
    id: string
  }
  assert.equal(
    (await api(cookie, 'PUT', `/projects/${project.id}/repositories/${repo.id}`)).status,
    204,
  )
  const linked = (await (
    await api(cookie, 'GET', `/projects/${project.id}/repositories`)
  ).json()) as Repo[]
  assert.deepEqual(
    linked.map((r) => r.fullName),
    ['octo/private-api'],
  )
  assert.equal(
    (await api(cookie, 'DELETE', `/projects/${project.id}/repositories/${repo.id}`)).status,
    204,
  )
  assert.equal(
    ((await (await api(cookie, 'GET', `/projects/${project.id}/repositories`)).json()) as Repo[])
      .length,
    0,
  )
})

test('a repository the account cannot see is refused', async () => {
  const cookie = await signUp('repo-404')
  await connectGithub(cookie)
  assert.equal((await api(cookie, 'POST', '/repositories', { externalId: '9999' })).status, 404)
  assert.equal((await api(cookie, 'POST', '/repositories', { externalId: 'abc' })).status, 400)
})

test('no linking or removal across workspaces', async () => {
  const owner = await signUp('repo-owner')
  await connectGithub(owner)
  const repo = (await (
    await api(owner, 'POST', '/repositories', { externalId: '1001' })
  ).json()) as Repo
  const intruder = await signUp('repo-intruder')
  const theirProject = (await (
    await api(intruder, 'POST', '/projects', { name: 'Mine' })
  ).json()) as { id: string }
  assert.equal(
    (await api(intruder, 'PUT', `/projects/${theirProject.id}/repositories/${repo.id}`)).status,
    404,
  )
  assert.equal((await api(intruder, 'DELETE', `/repositories/${repo.id}`)).status, 404)
  assert.equal(((await (await api(intruder, 'GET', '/repositories')).json()) as Repo[]).length, 0)
  assert.equal((await api(owner, 'DELETE', `/repositories/${repo.id}`)).status, 204)
})
