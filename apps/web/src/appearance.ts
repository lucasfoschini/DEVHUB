import { useEffect, useState } from 'react'
import type { Appearance } from '@devhub/design-tokens'

// 'system' removes the attribute so tokens.css follows the OS media queries.
export type ThemePref = 'system' | 'dark' | 'light'
export type MaterialPref = 'system' | Appearance

function usePref<T extends string>(key: string, attr: string, fallback: T) {
  const [value, setValue] = useState<T>(() => (localStorage.getItem(key) as T | null) ?? fallback)
  useEffect(() => {
    const root = document.documentElement
    if (value === 'system') root.removeAttribute(attr)
    else root.setAttribute(attr, value)
    localStorage.setItem(key, value)
  }, [key, attr, value])
  return [value, setValue] as const
}

export const useThemePref = () => usePref<ThemePref>('dh.theme', 'data-theme', 'system')
export const useMaterialPref = () => usePref<MaterialPref>('dh.material', 'data-material', 'system')
