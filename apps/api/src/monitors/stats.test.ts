import assert from 'node:assert/strict'
import { test } from 'node:test'
import { incidentAction, percentile, summarize } from './stats.ts'

test('nearest-rank percentile', () => {
  const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  assert.equal(percentile(xs, 50), 50)
  assert.equal(percentile(xs, 95), 100)
  assert.equal(percentile([], 50), null)
})

test('no data means null, not zero', () => {
  assert.deepEqual(summarize([]), { checks: 0, uptime: null, p50: null, p95: null, p99: null })
})

test('percentiles need enough successful samples; failures count against uptime', () => {
  const few = summarize([
    { ok: true, latencyMs: 100 },
    { ok: false, latencyMs: null },
  ])
  assert.equal(few.uptime, 0.5)
  assert.equal(few.p50, null)
  const many = summarize([120, 80, 100, 90, 110].map((latencyMs) => ({ ok: true, latencyMs })))
  assert.equal(many.uptime, 1)
  assert.equal(many.p50, 100)
  assert.equal(many.p95, 120)
})

test('incident opens on the second consecutive failure and resolves on success', () => {
  assert.equal(incidentAction(false, false, 1), 'none')
  assert.equal(incidentAction(false, false, 2), 'open')
  assert.equal(incidentAction(false, true, 3), 'none')
  assert.equal(incidentAction(true, true, 0), 'resolve')
  assert.equal(incidentAction(true, false, 0), 'none')
})
