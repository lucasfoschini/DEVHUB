import { createContext, use } from 'react'

export interface Me {
  user: { id: string; name: string; email: string }
  workspace: { id: string; name: string; role: 'owner' }
}

export interface SessionValue extends Me {
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionValue | null>(null)

/** Signed-in user and workspace. Only usable under <SessionGate>. */
export function useSession() {
  const value = use(SessionContext)
  if (!value) throw new Error('useSession outside <SessionGate>')
  return value
}

/** POST to the API. Better Auth and the API both check Origin, which the browser sets. */
export async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  return { ok: res.ok, status: res.status, message: data.message }
}
