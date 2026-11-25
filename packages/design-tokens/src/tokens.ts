// DevHub design tokens: single source of truth.
// CSS is generated from this file (src/build.ts). Mobile (Expo) will import it directly.
// Material names are DevHub tokens, not Apple APIs.

/** Primitive palette. Graphite Lime values from MASTER_PLAN §15 are kept verbatim. */
export const palette = {
  graphite: {
    950: '#111214', // Canvas (dark)
    900: '#17191C', // Surface (dark)
    850: '#1B1D20', // glass base (dark)
    800: '#24272B', // Elevated Surface (dark)
    750: '#2C2F34', // Border (dark)
    600: '#5F636B',
    500: '#6B6F76',
    400: '#8A8E95',
    350: '#9B9EA5', // Secondary Text (dark)
    100: '#E3E4E0',
    75: '#ECEDE9',
    50: '#F4F4F1',
    25: '#F7F7F4',
    0: '#FFFFFF',
    ink: '#F0F0ED', // Primary Text (dark)
  },
  lime: {
    300: '#D4F5A8',
    400: '#C6EF91', // Signature Lime
    700: '#4D722D', // action in light mode (lime 400 on white is 1.3:1)
    800: '#3F5E24',
  },
} as const

const g = palette.graphite
const lime = palette.lime

export type ThemeName = 'dark' | 'light'

export interface ThemeColors {
  canvas: string
  surface: string
  raised: string
  textPrimary: string
  textSecondary: string
  /** Disabled and decorative only: below 4.5:1 on purpose. */
  textTertiary: string
  borderSubtle: string
  borderControl: string
  focus: string
  brand: string
  /** Text and icons placed on the brand lime. */
  onBrand: string
  /** Backdrop behind modal sheets. */
  scrim: string
  accentText: string
  actionPrimary: string
  actionPrimaryHover: string
  actionPrimaryFg: string
  glassBase: string
  success: string
  warning: string
  error: string
  info: string
  neutral: string
  pending: string
  offline: string
  degraded: string
}

export const themes: Record<ThemeName, ThemeColors> = {
  dark: {
    canvas: g[950],
    surface: g[900],
    raised: g[800],
    textPrimary: g.ink,
    textSecondary: g[350],
    textTertiary: g[500],
    borderSubtle: g[750],
    borderControl: '#71757D',
    focus: lime[400],
    brand: lime[400],
    onBrand: g[950],
    scrim: 'rgb(0 0 0 / 0.5)',
    accentText: lime[400],
    actionPrimary: lime[400],
    actionPrimaryHover: lime[300],
    actionPrimaryFg: g[950],
    glassBase: g[850],
    success: '#5CD69B',
    warning: '#F2C15C',
    error: '#FF8A80',
    info: '#7AB8FF',
    neutral: g[350],
    pending: '#B4A7F5',
    offline: g[400],
    degraded: '#F5A25B',
  },
  light: {
    canvas: g[50],
    surface: g[0],
    raised: g[75],
    textPrimary: g[900],
    textSecondary: '#575B62',
    textTertiary: g[400],
    borderSubtle: g[100],
    borderControl: '#7C8087',
    focus: lime[700],
    brand: lime[400],
    onBrand: g[950],
    scrim: 'rgb(0 0 0 / 0.25)',
    accentText: lime[700],
    actionPrimary: lime[700],
    actionPrimaryHover: lime[800],
    actionPrimaryFg: g[0],
    glassBase: g[25],
    success: '#1E7349',
    warning: '#845400',
    error: '#BE3228',
    info: '#1F5CB8',
    neutral: '#575B62',
    pending: '#5E46BE',
    offline: '#5F636B',
    degraded: '#9A4A0C',
  },
}

/** Glass fill opacity (%) per user appearance preference (MASTER_PLAN §14.5). */
export type Appearance = 'clear' | 'balanced' | 'tinted' | 'opaque'
export type GlassVariant = 'regular' | 'clear' | 'tinted' | 'elevated'

export const glassAlpha: Record<Appearance, Record<GlassVariant, number>> = {
  clear: { regular: 60, clear: 40, tinted: 78, elevated: 86 },
  balanced: { regular: 74, clear: 52, tinted: 86, elevated: 90 },
  tinted: { regular: 86, clear: 72, tinted: 92, elevated: 94 },
  opaque: { regular: 100, clear: 100, tinted: 100, elevated: 100 },
}

/** Share of brand lime mixed into the tinted glass base (%). */
export const glassTintStrength = 6

export const glass = {
  blur: 24,
  saturate: 160,
  elevatedBlur: 32,
} as const

export const space = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const

export const radius = {
  content: 8, // tables, code, inputs (6–10)
  control: 8,
  surface: 12, // panels (10–14)
  popover: 16, // menus, overlays (14–22)
  floating: 22, // floating groups, Spotlight
  pill: 9999,
} as const

export const font = {
  sans: "'Geist Variable', ui-sans-serif, system-ui, sans-serif",
  mono: "'JetBrains Mono Variable', ui-monospace, 'Cascadia Code', monospace",
} as const

/** [size px, line-height px, weight, letter-spacing em] */
export const typeScale = {
  caption: [11, 14, 500, 0.01],
  footnote: [12, 16, 400, 0],
  body: [13, 20, 400, 0],
  callout: [15, 22, 400, -0.005],
  headline: [17, 24, 600, -0.01],
  title3: [20, 26, 600, -0.015],
  title2: [24, 30, 600, -0.02],
  title1: [30, 36, 600, -0.025],
  display: [36, 42, 650, -0.03],
} as const satisfies Record<string, readonly [number, number, number, number]>

export const motion = {
  duration: { instant: 100, fast: 160, normal: 240, slow: 380 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.3, 0, 0, 1.0)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  /** For the `motion` library (P7). Low bounce on purpose. */
  spring: {
    snappy: { type: 'spring', stiffness: 520, damping: 40, mass: 1 },
    smooth: { type: 'spring', stiffness: 300, damping: 34, mass: 1 },
    gentle: { type: 'spring', stiffness: 180, damping: 26, mass: 1 },
  },
} as const

export const elevation = {
  navigation: '0 1px 0 rgb(0 0 0 / 0.04)',
  inspector: '0 8px 24px rgb(0 0 0 / 0.12)',
  overlay: '0 12px 32px rgb(0 0 0 / 0.22), 0 2px 6px rgb(0 0 0 / 0.12)',
  modal: '0 24px 64px rgb(0 0 0 / 0.32), 0 4px 12px rgb(0 0 0 / 0.16)',
} as const

export const zIndex = {
  content: 0,
  navigation: 10,
  inspector: 20,
  shelf: 30,
  popover: 40,
  modal: 50,
  toast: 60,
} as const

/** Container/window widths (px). CSS media queries cannot read custom properties. */
export const breakpoints = {
  compact: 0, // phone: bottom bar, no sidebar
  medium: 600, // tablet portrait: compact sidebar
  expanded: 1024, // desktop: full sidebar
  large: 1440, // inspector fits beside content
} as const
