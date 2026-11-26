import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseInline, parseMarkdown } from './markdown.ts'

test('blocks: heading, list, code, quote, paragraph', () => {
  const md = '# Deploy\n\n- um\n- dois\n\n```sh\npnpm build\n```\n> nota\n\ntexto\ncontinua'
  assert.deepEqual(
    parseMarkdown(md).map((b) => b.t),
    ['h', 'ul', 'code', 'quote', 'p'],
  )
  const code = parseMarkdown(md)[2]
  assert.deepEqual(code, { t: 'code', lang: 'sh', v: 'pnpm build' })
  assert.deepEqual(parseMarkdown('texto\ncontinua')[0], {
    t: 'p',
    c: [{ t: 'text', v: 'texto continua' }],
  })
})

test('inline: code, bold, links; unsafe links stay text', () => {
  assert.deepEqual(parseInline('`a*b*` **x**'), [
    { t: 'code', v: 'a*b*' },
    { t: 'text', v: ' ' },
    { t: 'strong', c: [{ t: 'text', v: 'x' }] },
  ])
  assert.deepEqual(parseInline('[ok](https://x.dev)')[0], {
    t: 'link',
    href: 'https://x.dev',
    c: [{ t: 'text', v: 'ok' }],
  })
  assert.deepEqual(parseInline('[x](javascript:alert(1))')[0]?.t, 'text')
})

test('ordered list keeps every item', () => {
  const [list] = parseMarkdown('1. a\n2. b\n3. c')
  assert.equal(list?.t, 'ol')
  assert.equal(list && 'items' in list ? list.items.length : 0, 3)
})
