import assert from 'node:assert/strict'
import { test } from 'node:test'
import { notify } from './notify.ts'

function fakeDb(muted: string[]) {
  const created: unknown[] = []
  const db = {
    workspace: { findUnique: async () => ({ mutedNotificationKinds: muted }) },
    notification: { create: async (args: unknown) => created.push(args) },
  }
  return { db: db as unknown as Parameters<typeof notify>[0], created }
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
