import assert from 'node:assert/strict'
import { test } from 'node:test'
import { notify, webhookPayload } from './notify.ts'

function fakeDb(muted: string[], automations: { id: string; format: string }[] = []) {
  const created: unknown[] = []
  const runs: unknown[] = []
  const db = {
    workspace: { findUnique: async () => ({ mutedNotificationKinds: muted }) },
    notification: { create: async (args: unknown) => created.push(args) },
    automation: { findMany: async () => automations },
    automationRun: { createMany: async (args: { data: unknown[] }) => runs.push(...args.data) },
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
  assert.deepEqual(db.runs, [{ automationId: 'a1', payload: '{"text":"t"}' }])
})

test('webhook payload shapes', () => {
  const event = { kind: 'monitor.down', title: 'Site fora', body: 'timeout' } as const
  assert.deepEqual(JSON.parse(webhookPayload('discord', event)), { content: 'Site fora — timeout' })
  assert.equal(JSON.parse(webhookPayload('generic', event)).event, 'monitor.down')
})
