import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import { requireSameOrigin } from './origin.ts'

function run(method: string, origin?: string) {
  let status = 0
  let passed = false
  const req = { method, headers: origin ? { origin } : {} } as Request
  const res = {
    status(code: number) {
      status = code
      return { json: () => undefined }
    },
  } as unknown as Response
  requireSameOrigin('http://localhost:5173')(req, res, (() => (passed = true)) as NextFunction)
  return { status, passed }
}

test('safe methods pass without Origin', () => {
  assert.equal(run('GET').passed, true)
})

test('POST from the web origin passes', () => {
  assert.equal(run('POST', 'http://localhost:5173').passed, true)
})

test('POST from another origin is rejected', () => {
  assert.deepEqual(run('POST', 'https://evil.example'), { status: 403, passed: false })
})

test('POST without Origin is rejected', () => {
  assert.deepEqual(run('DELETE'), { status: 403, passed: false })
})
