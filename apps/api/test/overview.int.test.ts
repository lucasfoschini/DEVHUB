/** Command Center overview: observed counts only, scoped to the session's workspace. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api, connectGithub, signUp } from './server.ts'

interface Overview {
  projects: { byStatus: Record<string, number>; recent: { name: string }[] }
  monitors: { total: number; up: number; down: number; unknown: number; paused: number }
  openIncidents: unknown[]
  recentPushes: { fullName: string; pushedAt: string }[]
  github: { status: string; externalLogin: string } | null
  unreadNotifications: number
}

const overview = async (cookie: string) =>
  (await (await api(cookie, 'GET', '/overview')).json()) as Overview

test('empty workspace reports zeros and nulls, not invented data', async () => {
  const cookie = await signUp('ov-empty')
  assert.deepEqual(await overview(cookie), {
    projects: { byStatus: {}, recent: [] },
    monitors: { total: 0, up: 0, down: 0, unknown: 0, paused: 0 },
    openIncidents: [],
    recentPushes: [],
    github: null,
    unreadNotifications: 0,
  })
})

test('counts projects, monitors and pushes; other workspaces stay out', async () => {
  const cookie = await signUp('ov')
  const other = await signUp('ov-other')
  await api(cookie, 'POST', '/projects', { name: 'A', status: 'production' })
  await api(cookie, 'POST', '/projects', { name: 'B', status: 'archived' })
  await api(cookie, 'POST', '/monitors', { name: 'M1', url: 'http://127.0.0.1:9/' })
  const paused = (await (
    await api(cookie, 'POST', '/monitors', { name: 'M2', url: 'http://127.0.0.1:9/x' })
  ).json()) as { id: string }
  await api(cookie, 'PATCH', `/monitors/${paused.id}`, { enabled: false })
  await connectGithub(cookie)
  await api(cookie, 'POST', '/repositories', { externalId: '1002' })

  const o = await overview(cookie)
  assert.deepEqual(o.projects.byStatus, { production: 1, archived: 1 })
  // Archived projects are counted but not listed as recent.
  assert.deepEqual(
    o.projects.recent.map((p) => p.name),
    ['A'],
  )
  // The scheduler may have checked the enabled one already: its state is not asserted.
  assert.equal(o.monitors.total, 2)
  assert.equal(o.monitors.paused, 1)
  assert.equal(o.monitors.up + o.monitors.down + o.monitors.unknown, 1)
  assert.deepEqual(
    o.recentPushes.map((r) => r.fullName),
    ['octo/private-api'],
  )
  assert.equal(o.github?.status, 'connected')

  const empty = await overview(other)
  assert.equal(empty.monitors.total, 0)
  assert.deepEqual(empty.projects.byStatus, {})
})

test('unauthenticated is 401', async () => {
  assert.equal((await api('', 'GET', '/overview')).status, 401)
})
