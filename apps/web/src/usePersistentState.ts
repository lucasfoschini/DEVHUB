import { useEffect, useState } from 'react'

/** localStorage-backed state. Stored values outside `allowed` fall back to `initial`. */
export function usePersistentState<T extends string | number>(
  key: string,
  initial: T,
  allowed?: (value: T) => boolean,
) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key)
    if (raw === null) return initial
    const parsed = (typeof initial === 'number' ? Number(raw) : raw) as T
    const ok = typeof parsed === 'number' ? Number.isFinite(parsed) : true
    return ok && (allowed?.(parsed) ?? true) ? parsed : initial
  })
  useEffect(() => localStorage.setItem(key, String(value)), [key, value])
  return [value, setValue] as const
}

export const oneOf =
  <T>(...options: T[]) =>
  (v: T) =>
    options.includes(v)
