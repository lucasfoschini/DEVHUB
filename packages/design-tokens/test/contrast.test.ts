import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contrast, mix } from '../src/contrast.ts'
import {
  glassAlpha,
  glassTintStrength,
  themes,
  type Appearance,
  type GlassVariant,
  type ThemeName,
} from '../src/tokens.ts'

const TEXT = 4.5 // WCAG 1.4.3 normal text
const UI = 3 // WCAG 1.4.11 non-text (control borders, focus)

const statuses = [
  'success',
  'warning',
  'error',
  'info',
  'neutral',
  'pending',
  'offline',
  'degraded',
] as const

function check(fg: string, bg: string, min: number, label: string) {
  const ratio = contrast(fg, bg)
  assert.ok(ratio >= min, `${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (needs ${min}:1)`)
}

for (const name of Object.keys(themes) as ThemeName[]) {
  const t = themes[name]
  const backgrounds = { canvas: t.canvas, surface: t.surface, raised: t.raised }

  test(`${name}: text on solid surfaces`, () => {
    for (const [bgName, bg] of Object.entries(backgrounds)) {
      check(t.textPrimary, bg, TEXT, `textPrimary/${bgName}`)
      check(t.textSecondary, bg, TEXT, `textSecondary/${bgName}`)
      check(t.accentText, bg, TEXT, `accentText/${bgName}`)
      for (const s of statuses) check(t[s], bg, TEXT, `${s}/${bgName}`)
    }
  })

  test(`${name}: primary action`, () => {
    check(t.actionPrimaryFg, t.actionPrimary, TEXT, 'actionPrimaryFg/actionPrimary')
    check(t.actionPrimaryFg, t.actionPrimaryHover, TEXT, 'actionPrimaryFg/actionPrimaryHover')
    check(t.actionPrimary, t.surface, UI, 'actionPrimary/surface')
  })

  test(`${name}: controls and focus`, () => {
    for (const [bgName, bg] of Object.entries(backgrounds)) {
      check(t.borderControl, bg, UI, `borderControl/${bgName}`)
      check(t.focus, bg, UI, `focus/${bgName}`)
    }
  })

  // Glass is approximated as an sRGB alpha blend over the content beneath it.
  // Blur averages that content, so a flat underlay is the worst case per colour.
  test(`${name}: text on glass in every appearance`, () => {
    // Lime is limited to small accents (MASTER_PLAN §15), so blur averages it with the
    // canvas. Model the worst realistic region as 25% lime coverage.
    const underlays = { ...backgrounds, brandRegion: mix(t.brand, t.canvas, 25) }
    const tinted = mix(t.brand, t.glassBase, glassTintStrength)
    for (const appearance of Object.keys(glassAlpha) as Appearance[]) {
      const variants: GlassVariant[] = ['regular', 'tinted', 'elevated']
      for (const variant of variants) {
        const base = variant === 'tinted' ? tinted : t.glassBase
        for (const [uName, u] of Object.entries(underlays)) {
          const bg = mix(base, u, glassAlpha[appearance][variant])
          const label = `${appearance}/${variant} over ${uName}`
          check(t.textPrimary, bg, TEXT, `textPrimary ${label}`)
          check(t.textSecondary, bg, TEXT, `textSecondary ${label}`)
        }
      }
      // Clear glass is for controls over the ambient canvas only, never over content.
      const clearBg = mix(t.glassBase, t.canvas, glassAlpha[appearance].clear)
      check(t.textPrimary, clearBg, TEXT, `textPrimary ${appearance}/clear over canvas`)
    }
  })
}

test('statuses are distinct from the brand colour', () => {
  for (const name of Object.keys(themes) as ThemeName[]) {
    const t = themes[name]
    for (const s of statuses) assert.notEqual(t[s].toLowerCase(), t.brand.toLowerCase(), s)
  }
})
