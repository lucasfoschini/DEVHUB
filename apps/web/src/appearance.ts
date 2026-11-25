import { useEffect } from 'react'
import type { Appearance } from '@devhub/design-tokens'
import { oneOf, usePersistentState } from './usePersistentState'

// 'system' removes the attribute so tokens.css follows the OS media queries.
export type ThemePref = 'system' | 'dark' | 'light'
export type MaterialPref = 'system' | Appearance

function useRootAttribute(attr: string, value: string) {
  useEffect(() => {
    const root = document.documentElement
    if (value === 'system') root.removeAttribute(attr)
    else root.setAttribute(attr, value)
  }, [attr, value])
}

export function useThemePref() {
  const state = usePersistentState<ThemePref>(
    'dh.theme',
    'system',
    oneOf<ThemePref>('system', 'dark', 'light'),
  )
  useRootAttribute('data-theme', state[0])
  return state
}

export function useMaterialPref() {
  const state = usePersistentState<MaterialPref>(
    'dh.material',
    'system',
    oneOf<MaterialPref>('system', 'clear', 'balanced', 'tinted', 'opaque'),
  )
  useRootAttribute('data-material', state[0])
  return state
}
