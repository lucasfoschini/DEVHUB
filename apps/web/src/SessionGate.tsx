import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { postJson, SessionContext, type Me } from './session'
import { SignIn } from './SignIn'

type State = { status: 'loading' } | { status: 'signed-out' } | { status: 'offline' } | Me

async function fetchMe(): Promise<State> {
  try {
    const res = await fetch('/api/me')
    if (res.status === 401) return { status: 'signed-out' }
    if (!res.ok) return { status: 'offline' }
    return (await res.json()) as Me
  } catch {
    return { status: 'offline' }
  }
}

/** Renders children only with a valid session; otherwise the sign-in screen. */
export function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  // Bumping this re-fetches /api/me (after sign-in or a retry).
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    void fetchMe().then((next) => live && setState(next))
    return () => {
      live = false
    }
  }, [attempt])

  const signOut = useCallback(async () => {
    await postJson('/api/auth/sign-out', {})
    setState({ status: 'signed-out' })
  }, [])

  const reload = () => setAttempt((n) => n + 1)

  if ('user' in state) {
    return <SessionContext value={{ ...state, signOut, reload }}>{children}</SessionContext>
  }
  if (state.status === 'loading') return null
  if (state.status === 'offline') return <Offline onRetry={reload} />
  return <SignIn onSignedIn={reload} />
}

function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-surface border border-subtle bg-surface p-6">
        <h1 className="text-title3">API indisponível</h1>
        <p className="mt-2 text-body text-secondary">
          O DevHub não conseguiu falar com a API. Em desenvolvimento, rode{' '}
          <code className="text-primary">docker compose up -d</code> e{' '}
          <code className="text-primary">pnpm dev</code>.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 h-9 rounded-control bg-action px-4 text-body font-medium text-action-fg hover:bg-action-hover"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  )
}
