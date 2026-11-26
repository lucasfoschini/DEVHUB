import { useId, useState, type FormEvent } from 'react'
import { postJson } from './session'

const MIN_PASSWORD = 12

const field =
  'h-10 w-full rounded-control border border-control bg-canvas px-3 text-body text-primary placeholder:text-tertiary'

/** Email and password sign-in and sign-up (ADR 0003). */
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = useId()
  const signUp = mode === 'sign-up'

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    setBusy(true)
    setError(null)
    const res = signUp
      ? await postJson('/api/auth/sign-up/email', { email, password, name: form.get('name') })
      : await postJson('/api/auth/sign-in/email', { email, password })
    setBusy(false)
    if (res.ok) return onSignedIn()
    setError(
      res.status === 401
        ? 'E-mail ou senha incorretos.'
        : res.status === 429
          ? 'Muitas tentativas. Aguarde um pouco e tente de novo.'
          : (res.message ?? 'Não foi possível continuar. Tente de novo.'),
    )
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-surface border border-subtle bg-surface p-6">
        <h1 className="text-title2">{signUp ? 'Criar conta' : 'Entrar no DevHub'}</h1>
        <p className="mt-1 text-body text-secondary">
          {signUp
            ? 'Seu workspace pessoal é criado no primeiro acesso.'
            : 'Use seu e-mail e senha.'}
        </p>
        <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
          {signUp && (
            <div className="space-y-1">
              <label htmlFor={`${id}-name`} className="text-footnote font-medium">
                Nome
              </label>
              <input id={`${id}-name`} name="name" required autoComplete="name" className={field} />
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor={`${id}-email`} className="text-footnote font-medium">
              E-mail
            </label>
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              required
              autoComplete="email"
              className={field}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-password`} className="text-footnote font-medium">
              Senha
            </label>
            <input
              id={`${id}-password`}
              name="password"
              type="password"
              required
              minLength={signUp ? MIN_PASSWORD : undefined}
              autoComplete={signUp ? 'new-password' : 'current-password'}
              aria-describedby={signUp ? `${id}-hint` : undefined}
              className={field}
            />
            {signUp && (
              <p id={`${id}-hint`} className="text-caption text-secondary">
                Pelo menos {MIN_PASSWORD} caracteres.
              </p>
            )}
          </div>
          <p role="alert" className="text-footnote text-error empty:hidden">
            {error}
          </p>
          <button
            type="submit"
            disabled={busy}
            className="h-10 w-full rounded-control bg-action text-body font-medium text-action-fg hover:bg-action-hover disabled:opacity-60"
          >
            {busy ? 'Aguarde…' : signUp ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(signUp ? 'sign-in' : 'sign-up')
            setError(null)
          }}
          className="mt-4 text-footnote text-accent underline-offset-2 hover:underline"
        >
          {signUp ? 'Já tenho conta' : 'Criar uma conta'}
        </button>
      </div>
    </main>
  )
}
