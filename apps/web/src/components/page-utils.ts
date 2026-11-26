import { useEffect, useState } from 'react'
import { request } from '../session'

/** GET a JSON resource; `reload()` re-fetches. `error` is the HTTP status (0 = network). */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: number | null }>({
    data: null,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!path) return
    let live = true
    void request<T>('GET', path).then(
      (res) =>
        live &&
        setState(res.ok ? { data: res.data, error: null } : { data: null, error: res.status }),
      () => live && setState({ data: null, error: 0 }),
    )
    return () => {
      live = false
    }
  }, [path, attempt])

  return { ...state, reload: () => setAttempt((n) => n + 1) }
}

export const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
export const formatDate = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : '—')

export const ENVIRONMENTS = ['development', 'staging', 'production'] as const
export type Environment = (typeof ENVIRONMENTS)[number]
export const ENV_LABEL: Record<Environment, string> = {
  development: 'Desenvolvimento',
  staging: 'Staging',
  production: 'Produção',
}

export const inlineLink = 'text-footnote text-secondary underline hover:text-primary'
export const rowButton =
  'inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-footnote text-secondary hover:bg-hover hover:text-primary disabled:opacity-60'
