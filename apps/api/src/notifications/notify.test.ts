import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matches, notify, webhookPayload } from './notify.ts'

type Auto = { id: string; format: string; action?: string; condition?: string | null }
function fakeDb(muted: string[], list: Auto[] = []) {
  const automations = list.map((a) => ({
    workspaceId: 'w',
    action: 'webhook',
    message: null,
    condition: null,
    ...a,
  }))
  const created: unknown[] = []
  const runs: unknown[] = []
  const db = {
    workspace: { findUnique: async () => ({ mutedNotificationKinds: muted }) },
    notification: { create: async (args: unknown) => created.push(args) },
    automation: { findMany: async () => automations },
    automationRun: { create: async (args: { data: unknown }) => runs.push(args.data) },
  }
  return { db: db as unknown as Parameters<typeof notify>[0], created, runs }
}

const data = { workspaceId: 'w', kind: 'monitor.down', severity: 'critical', title: 't' } as const

test('a muted kind is not created; others are', async () => {
  const muted = fakeDb(['monitor.down'])
  await notify(muted.db, { data })
  assert.equal(muted.created.length, 0)

  const open = fakeDb(['monitor.recovered'])
  await notify(open.db, { data })
  assert.deepEqual(open.created, [{ data }])
})

test('automations are queued even when the in-app kind is muted', async () => {
  const db = fakeDb(['monitor.down'], [{ id: 'a1', format: 'slack' }])
  await notify(db.db, { data })
  assert.equal(db.created.length, 0)
  assert.deepEqual(db.runs, [{ automationId: 'a1', attempts: 0, payload: '{"text":"t"}' }])
})

test('conditions filter; the notification action creates an automation-kind notification', async () => {
  const db = fakeDb(
    [],
    [
      { id: 'skip', format: 'generic', condition: 'api' },
      { id: 'n1', format: 'generic', action: 'notification', condition: 'T' },
    ],
  )
  await notify(db.db, { data })
  assert.equal(db.created.length, 2)
  assert.equal((db.created[1] as { data: { kind: string } }).data.kind, 'automation')
  assert.deepEqual(
    db.runs.map((r) => (r as { automationId: string; status?: string }).status),
    ['succeeded'],
  )
  assert.equal(matches(null, { title: 'x' }), true)
  assert.equal(matches('DOWN', { title: 'api', body: 'is down' }), true)
})

test('webhook payload shapes', () => {
  const event = { kind: 'monitor.down', title: 'Site fora', body: 'timeout' } as const
  assert.deepEqual(JSON.parse(webhookPayload('discord', event)), { content: 'Site fora — timeout' })
  assert.equal(JSON.parse(webhookPayload('generic', event)).event, 'monitor.down')
})
