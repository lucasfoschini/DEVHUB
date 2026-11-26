import { createContext, use } from 'react'

export interface Me {
  user: { id: string; name: string; email: string }
  workspace: { id: string; name: string; role: 'owner' }
}

export interface SessionValue extends Me {
  signOut: () => Promise<void>
  /** Re-reads /api/me (after a profile change). */
  reload: () => void
}

export const SessionContext = createContext<SessionValue | null>(null)

/** Signed-in user and workspace. Only usable under <SessionGate>. */
export function useSession() {
  const value = use(SessionContext)
  if (!value) throw new Error('useSession outside <SessionGate>')
  return value
}

/** JSON request to the API. Better Auth and the API both check Origin, which the browser sets
 *  on non-GET requests. `data` is the parsed body (or {} when there is none). */
export async function request<T = unknown>(method: string, path: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { message?: string }
  return { ok: res.ok, status: res.status, data, message: data.message }
}

export const postJson = (path: string, body: unknown) => request('POST', path, body)
