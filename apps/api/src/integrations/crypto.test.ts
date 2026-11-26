import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { decrypt, encrypt, parseKey } from './crypto.ts'

const key = randomBytes(32)

test('round-trips and never stores the plaintext', () => {
  const stored = encrypt('gho_secret_token', key)
  assert.ok(!stored.includes('gho_secret_token'))
  assert.equal(decrypt(stored, key), 'gho_secret_token')
})

test('same input encrypts differently each time (random IV)', () => {
  assert.notEqual(encrypt('x', key), encrypt('x', key))
})

test('tampering or a wrong key fails', () => {
  const stored = encrypt('gho_secret_token', key)
  const parts = stored.split(':')
  const data = Buffer.from(parts[3]!, 'base64')
  data[0]! ^= 1
  parts[3] = data.toString('base64')
  assert.throws(() => decrypt(parts.join(':'), key))
  assert.throws(() => decrypt(stored, randomBytes(32)))
})

test('key must be exactly 32 bytes', () => {
  assert.throws(() => parseKey(randomBytes(16).toString('base64')), /32 bytes/)
  assert.equal(parseKey(key.toString('base64')).length, 32)
})
