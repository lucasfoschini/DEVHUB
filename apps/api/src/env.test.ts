import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadEnv } from './env.ts'

const valid = {
  DATABASE_URL: 'postgresql://u:p@127.0.0.1:5433/db',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  WEB_ORIGIN: 'http://localhost:5173/',
}

test('normalizes origin and defaults port', () => {
  const env = loadEnv(valid)
  assert.equal(env.webOrigin, 'http://localhost:5173')
  assert.equal(env.port, 3000)
})

test('names every missing variable', () => {
  assert.throws(() => loadEnv({}), /DATABASE_URL, BETTER_AUTH_SECRET, WEB_ORIGIN/)
})

test('rejects a short secret', () => {
  assert.throws(() => loadEnv({ ...valid, BETTER_AUTH_SECRET: 'short' }), /at least 32/)
})

test('rejects an invalid port', () => {
  assert.throws(() => loadEnv({ ...valid, PORT: 'abc' }), /PORT/)
})

test('GitHub is optional, but complete when enabled', () => {
  assert.equal(loadEnv(valid).github, null)
  assert.throws(
    () => loadEnv({ ...valid, GITHUB_CLIENT_ID: 'id' }),
    /GITHUB_CLIENT_SECRET, ENCRYPTION_KEY/,
  )
  const env = loadEnv({
    ...valid,
    GITHUB_CLIENT_ID: 'id',
    GITHUB_CLIENT_SECRET: 's',
    ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  })
  assert.equal(env.github?.redirectUri, 'http://localhost:5173/api/integrations/github/callback')
})
