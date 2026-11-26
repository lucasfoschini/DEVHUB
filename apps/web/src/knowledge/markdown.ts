/** A small Markdown subset parsed to a plain tree, rendered by React (never as HTML, so a note
 *  cannot inject markup or scripts). Supports headings, paragraphs, lists, quotes, fenced code,
 *  rules, and inline code, bold, italic and links (http, https, mailto and relative only). */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] }

export type Block =
  | { t: 'h'; level: 1 | 2 | 3; c: Inline[] }
  | { t: 'p'; c: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] }
  | { t: 'quote'; c: Inline[] }
  | { t: 'code'; lang: string; v: string }
  | { t: 'hr' }

const SAFE_HREF = /^(https?:\/\/|mailto:|\/|#)/i

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  // Order matters: code spans first so their content is not parsed further.
  const re = /`([^`]+)`|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] })
    else if (m[2] !== undefined) out.push({ t: 'strong', c: parseInline(m[2]) })
    else if (m[3] !== undefined) out.push({ t: 'em', c: parseInline(m[3]) })
    else if (SAFE_HREF.test(m[5]!)) out.push({ t: 'link', href: m[5]!, c: parseInline(m[4]!) })
    else out.push({ t: 'text', v: m[0] })
    last = re.lastIndex
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) })
  return out
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    const fence = /^```(\S*)/.exec(line)
    if (fence) {
      const body: string[] = []
      for (i++; i < lines.length && !lines[i]!.startsWith('```'); i++) body.push(lines[i]!)
      blocks.push({ t: 'code', lang: fence[1] ?? '', v: body.join('\n') })
      i++
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ t: 'h', level: heading[1]!.length as 1 | 2 | 3, c: parseInline(heading[2]!) })
      i++
      continue
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ t: 'hr' })
      i++
      continue
    }
    const list = /^\s*([-*]|\d+\.)\s+/.exec(line)
    if (list) {
      const ordered = /\d/.test(list[1]!)
      const items: Inline[][] = []
      const marker = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/
      for (let m = marker.exec(lines[i] ?? ''); m; m = marker.exec(lines[++i] ?? '')) {
        items.push(parseInline(m[1]!))
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', items })
      continue
    }
    if (line.startsWith('>')) {
      const quote: string[] = []
      for (; i < lines.length && lines[i]!.startsWith('>'); i++) {
        quote.push(lines[i]!.replace(/^>\s?/, ''))
      }
      blocks.push({ t: 'quote', c: parseInline(quote.join(' ')) })
      continue
    }
    const para: string[] = []
    for (
      ;
      i < lines.length &&
      lines[i]!.trim() &&
      !/^(#{1,3}\s|```|>|\s*([-*]|\d+\.)\s)/.test(lines[i]!);
      i++
    ) {
      para.push(lines[i]!.trim())
    }
    blocks.push({ t: 'p', c: parseInline(para.join(' ')) })
  }
  return blocks
}
