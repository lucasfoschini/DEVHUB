// WCAG 2.x relative luminance and contrast ratio for #RRGGBB colours.

type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m?.[1]) throw new Error(`Expected #RRGGBB, got ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** sRGB alpha blend of `top` at `percent`% over `bottom`; mirrors color-mix(in srgb, ...). */
export function mix(top: string, bottom: string, percent: number): string {
  const t = hexToRgb(top)
  const b = hexToRgb(bottom)
  const a = percent / 100
  return rgbToHex([0, 1, 2].map((i) => t[i]! * a + b[i]! * (1 - a)) as Rgb)
}
