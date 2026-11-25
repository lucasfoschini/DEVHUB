import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activity } from './store.ts'

const find = (id: string) => activity.list().find((a) => a.id === id)

test('progress is clamped to 0..1', () => {
  const id = activity.start({ kind: 'build', title: 'clamp', simulated: true, progress: 0 })
  activity.update(id, { progress: 1.7 })
  assert.equal(find(id)?.progress, 1)
  activity.update(id, { progress: -3 })
  assert.equal(find(id)?.progress, 0)
  activity.dismiss(id)
})

test('final states are frozen, stamp endedAt and drop controls', () => {
  const id = activity.start({
    kind: 'deploy',
    title: 'final',
    simulated: true,
    controls: { cancel: () => {} },
  })
  activity.update(id, { status: 'failed', error: 'boom' })
  activity.update(id, { status: 'running' })
  const a = find(id)
  assert.equal(a?.status, 'failed')
  assert.ok(a?.endedAt)
  assert.equal(a?.controls, undefined)
  activity.dismiss(id)
})

test('completed items auto-dismiss; failed items stay', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const done = activity.start({ kind: 'sync', title: 'done', simulated: true })
  const failed = activity.start({ kind: 'sync', title: 'failed', simulated: true })
  activity.update(done, { status: 'completed' })
  activity.update(failed, { status: 'failed' })
  t.mock.timers.tick(8000)
  assert.equal(find(done), undefined)
  assert.equal(find(failed)?.status, 'failed')
  activity.dismiss(failed)
})
