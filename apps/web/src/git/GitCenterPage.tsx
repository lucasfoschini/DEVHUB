import { useEffect, useId, useState } from 'react'
import { useSearchParams } from 'react-router'
import { GitBranch, Unplug } from 'lucide-react'
import { primaryButton, secondaryButton } from '../components/formStyles'
import { request } from '../session'
import { LocalFolders } from './LocalFolders'
import { RepositoriesSection } from './RepositoriesSection'

interface Status {
  configured: boolean
  integration: {
    externalLogin: string
    scopes: string[]
    status: 'connected' | 'needs_reconnect'
    createdAt: string
  } | null
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

const ACCESS = [
  {
    value: 'public',
    label: 'Somente repositórios públicos',
    detail: 'Escopo read:user. O token não consegue escrever em nada.',
  },
  {
    value: 'private',
    label: 'Incluir repositórios privados',
    detail:
      'Escopo repo. O GitHub não oferece leitura privada sem escrita para OAuth Apps: o token também permitiria escrever. O DevHub só faz leituras.',
  },
] as const

export function GitCenterPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [params, setParams] = useSearchParams()
  const outcome = params.get('github')

  useEffect(() => {
    let live = true
    void request<Status>('GET', '/api/integrations/github').then((res) => {
      if (!live) return
      if (res.ok) setStatus(res.data)
      else setLoadError(true)
    })
    return () => {
      live = false
    }
  }, [attempt])

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
          Git Center
        </h1>
        <p className="mt-1 text-callout text-secondary">
          Conexão com o GitHub e repositórios importados. Somente leitura.
        </p>
      </header>

      {outcome && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between gap-3 rounded-surface border border-subtle bg-surface px-4 py-3"
        >
          <span className={outcome === 'connected' ? 'text-success' : 'text-error'}>
            {outcome === 'connected'
              ? 'GitHub conectado.'
              : 'Não foi possível conectar. A autorização pode ter sido cancelada ou expirada; tente de novo.'}
          </span>
          <button
            type="button"
            className="text-footnote text-secondary hover:text-primary"
            onClick={() => setParams({}, { replace: true })}
          >
            Fechar
          </button>
        </div>
      )}

      <section
        aria-labelledby="github-title"
        className="rounded-surface border border-subtle bg-surface p-5"
      >
        <h2 id="github-title" className="flex items-center gap-2 text-headline">
          <GitBranch size={18} aria-hidden /> GitHub
        </h2>
        {loadError ? (
          <div className="mt-2">
            <p role="alert" className="text-error">
              Não foi possível carregar o estado da integração.
            </p>
            <button
              type="button"
              className={`${secondaryButton} mt-3`}
              onClick={() => {
                setLoadError(false)
                setAttempt((n) => n + 1)
              }}
            >
              Tentar de novo
            </button>
          </div>
        ) : status === null ? (
          <p className="mt-2 text-secondary">Carregando…</p>
        ) : !status.configured ? (
          <p className="mt-2 text-secondary">
            Integração não configurada no servidor. Defina <code>GITHUB_CLIENT_ID</code>,{' '}
            <code>GITHUB_CLIENT_SECRET</code> e <code>ENCRYPTION_KEY</code> em{' '}
            <code>apps/api/.env</code>.
          </p>
        ) : status.integration ? (
          <Connected
            integration={status.integration}
            onDisconnected={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <ConnectForm />
        )}
      </section>

      {status?.integration?.status === 'connected' && <RepositoriesSection />}
      <LocalFolders />
    </div>
  )
}

function ConnectForm() {
  const [access, setAccess] = useState<'public' | 'private'>('public')
  const name = useId()
  return (
    <form
      className="mt-3 space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        // Top-level navigation: the API sets the state cookie and redirects to GitHub.
        window.location.assign(`/api/integrations/github/connect?access=${access}`)
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-footnote font-medium">Acesso pedido ao GitHub</legend>
        {ACCESS.map((a) => (
          <label
            key={a.value}
            className="flex cursor-pointer gap-3 rounded-control border border-subtle p-3 has-checked:border-control has-checked:bg-hover"
          >
            <input
              type="radio"
              name={name}
              value={a.value}
              checked={access === a.value}
              onChange={() => setAccess(a.value)}
              className="mt-1 accent-(--dh-color-action-primary)"
            />
            <span>
              <span className="block text-body font-medium">{a.label}</span>
              <span className="block text-footnote text-secondary">{a.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-footnote text-secondary">
        O token fica criptografado no servidor e nunca chega ao navegador. Desconectar revoga a
        autorização no GitHub.
      </p>
      <button type="submit" className={primaryButton}>
        <GitBranch size={16} aria-hidden /> Conectar GitHub
      </button>
    </form>
  )
}

function Connected(props: {
  integration: NonNullable<Status['integration']>
  onDisconnected: () => void
}) {
  const { integration: i } = props
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function disconnect() {
    setBusy(true)
    setError(null)
    const res = await request<{ revokedAtProvider: boolean }>('DELETE', '/api/integrations/github')
    setBusy(false)
    if (!res.ok) return setError('Não foi possível desconectar. Tente de novo.')
    props.onDisconnected()
  }

  return (
    <div className="mt-3 space-y-3">
      <dl className="grid gap-x-6 gap-y-2 text-body md:grid-cols-[max-content_1fr]">
        <dt className="text-secondary">Conta</dt>
        <dd className="font-medium">@{i.externalLogin}</dd>
        <dt className="text-secondary">Escopos concedidos</dt>
        <dd className="font-mono text-footnote">{i.scopes.join(', ') || '(nenhum)'}</dd>
        <dt className="text-secondary">Conectado em</dt>
        <dd>{dateFormat.format(new Date(i.createdAt))}</dd>
        <dt className="text-secondary">Estado</dt>
        <dd className={i.status === 'connected' ? 'text-success' : 'text-warning'}>
          {i.status === 'connected'
            ? 'Conectado'
            : 'O GitHub recusou o token. Desconecte e conecte de novo.'}
        </dd>
      </dl>
      {i.scopes.includes('repo') && (
        <p className="text-footnote text-secondary">
          O escopo <code>repo</code> também permite escrita. O DevHub só faz leituras.
        </p>
      )}
      <p role="alert" className="text-footnote text-error empty:hidden">
        {error}
      </p>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-footnote text-secondary">
            Revoga a autorização no GitHub e apaga o token.
          </span>
          <button
            type="button"
            disabled={busy}
            className={`${secondaryButton} text-error`}
            onClick={() => void disconnect()}
          >
            <Unplug size={16} aria-hidden /> Confirmar
          </button>
          <button type="button" className={secondaryButton} onClick={() => setConfirm(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" className={secondaryButton} onClick={() => setConfirm(true)}>
          <Unplug size={16} aria-hidden /> Desconectar
        </button>
      )}
    </div>
  )
}
