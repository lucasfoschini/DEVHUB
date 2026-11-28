import assert from 'node:assert/strict'
import { test } from 'node:test'
import { accessToken, pairingCode, TOKEN_TTL_MS, verifyToken } from './token.ts'

const key = 'k'.repeat(32)

test('agent token: valid until expiry, bound to key and device', () => {
  const { token } = accessToken(key, 'dev-1', 1_000)
  assert.equal(verifyToken(key, token, 1_000), 'dev-1')
  assert.equal(verifyToken(key, token, 1_000 + TOKEN_TTL_MS), null)
  assert.equal(verifyToken('x'.repeat(32), token, 1_000), null)
  const [, expiry, sig] = token.split('.')
  assert.equal(verifyToken(key, `dev-2.${expiry}.${sig}`, 1_000), null)
  assert.equal(verifyToken(key, 'garbage', 1_000), null)
})

test('pairing code: 8 unambiguous characters', () => {
  for (let i = 0; i < 50; i++) assert.match(pairingCode(), /^[A-HJ-NP-Z2-9]{8}$/)
})
