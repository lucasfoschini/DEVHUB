/** Plain-text table: columns padded to the widest cell, no colors, safe to pipe. */
export function table(head: string[], rows: (string | number | null | undefined)[][]) {
  const cells = [
    head,
    ...rows.map((r) => r.map((c) => (c === null || c === undefined ? '—' : String(c)))),
  ]
  const widths = head.map((_, i) => Math.max(...cells.map((r) => (r[i] ?? '').length)))
  return cells
    .map((r) =>
      r
        .map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]!)))
        .join('  ')
        .trimEnd(),
    )
    .join('\n')
}

export const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null

/** `--flag value`, `--flag=value` and `--switch` after the positional words. */
export function parseArgs(argv: string[]) {
  const words: string[] = []
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (!a.startsWith('--')) {
      words.push(a)
      continue
    }
    const [key, inline] = a.slice(2).split(/=(.*)/s, 2) as [string, string | undefined]
    const next = argv[i + 1]
    if (inline !== undefined) flags[key] = inline
    else if (next !== undefined && !next.startsWith('--') && VALUE_FLAGS.has(key))
      flags[key] = argv[++i]!
    else flags[key] = true
  }
  return { words, flags }
}

const VALUE_FLAGS = new Set(['url', 'email', 'description'])
