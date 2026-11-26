import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { probe } from './probe.ts'
import { isPublicAddress, urlProblem } from './ssrf.ts'

test('blocks private, loopback, link-local and metadata addresses', () => {
  for (const ip of [
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
  ]) {
    assert.equal(isPublicAddress(ip), false, ip)
  }
})

test('allows public addresses', () => {
  for (const ip of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111', '::ffff:1.1.1.1']) {
    assert.equal(isPublicAddress(ip), true, ip)
  }
})

test('rejects non-http schemes and credentials', () => {
  assert.equal(urlProblem('file:///etc/passwd'), 'unsupported_protocol')
  assert.equal(urlProblem('gopher://x'), 'unsupported_protocol')
  assert.equal(urlProblem('http://user:pass@example.com'), 'credentials_in_url')
  assert.equal(urlProblem('not a url'), 'invalid_url')
  assert.equal(urlProblem('https://example.com/health'), null)
})

test('probe refuses loopback even through a hostname', async () => {
  const r = await probe('http://localhost:9/', { timeoutMs: 2000 })
  assert.deepEqual(r, { ok: false, error: 'blocked_address' })
})

test('probe refuses IP literals, including metadata and IPv6 loopback', async () => {
  for (const url of [
    'http://127.0.0.1:9/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]:9/',
    'http://[::ffff:10.0.0.1]/',
  ]) {
    assert.deepEqual(
      await probe(url, { timeoutMs: 2000 }),
      { ok: false, error: 'blocked_address' },
      url,
    )
  }
})

test('probe follows redirects and reports the final hop', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { location: 'http://127.0.0.1:9/' })
    } else if (req.url === '/down') {
      res.writeHead(503)
    } else {
      res.writeHead(200)
    }
    res.end()
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`
  try {
    // allowPrivate lets the test reach its own local server; the redirect target is unreachable.
    const up = await probe(`${base}/`, { timeoutMs: 2000, allowPrivate: true })
    assert.equal(up.ok, true)
    assert.equal(up.statusCode, 200)
    assert.ok(up.latencyMs !== undefined)
    const down = await probe(`${base}/down`, { timeoutMs: 2000, allowPrivate: true })
    assert.deepEqual(
      { ok: down.ok, statusCode: down.statusCode, error: down.error },
      { ok: false, statusCode: 503, error: 'http_status' },
    )
    const redirected = await probe(`${base}/redirect`, { timeoutMs: 2000, allowPrivate: true })
    assert.equal(redirected.ok, false)
    assert.equal(redirected.error, 'connection_refused')
  } finally {
    server.close()
  }
})

test('probe times out', async () => {
  const server = createServer(() => {
    /* never answers */
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  try {
    const r = await probe(`http://127.0.0.1:${port}/`, { timeoutMs: 300, allowPrivate: true })
    assert.deepEqual(r, { ok: false, error: 'timeout' })
  } finally {
    server.closeAllConnections()
    server.close()
  }
})
