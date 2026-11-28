import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cookiePairs } from './client.ts'
import { parseArgs, table } from './format.ts'

test('table pads columns and marks empty cells', () => {
  assert.equal(
    table(
      ['Nome', 'Estado'],
      [
        ['api', 'up'],
        ['web-front', null],
      ],
    ),
    'Nome       Estado\napi        up\nweb-front  —',
  )
})

test('args: positional words, value flags and switches', () => {
  assert.deepEqual(
    parseArgs(['projects', 'register', 'Loja', '--description', 'E-commerce', '--json']),
    {
      words: ['projects', 'register', 'Loja'],
      flags: { description: 'E-commerce', json: true },
    },
  )
  assert.deepEqual(parseArgs(['login', '--url=https://x.dev', '--password-stdin']).flags, {
    url: 'https://x.dev',
    'password-stdin': true,
  })
})

test('cookie pairs keep name=value only and drop cleared cookies', () => {
  assert.equal(
    cookiePairs([
      'better-auth.session_token=abc.def; Path=/; HttpOnly; SameSite=Lax',
      'better-auth.dont_remember=; Max-Age=0',
    ]),
    'better-auth.session_token=abc.def',
  )
})
