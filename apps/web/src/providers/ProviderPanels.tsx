import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'
import { Panel } from '../components/page'
import { formatDate, inlineLink, rowButton, useApi } from '../components/page-utils'
import { request } from '../session'

type Provider = 'render' | 'vercel' | 'neon'

interface Integration {
  externalLogin: string
  status: string
  createdAt: string
}

/** Where each provider issues the API key, shown next to the input. */
const KEY_HELP: Record<Provider, { url: string; where: string }> = {
  render: {
    url: 'https://dashboard.render.com/u/settings#api-keys',
    where: 'Render → Account Settings → API Keys',
  },
  vercel: {
    url: 'https://vercel.com/account/settings/tokens',
    where: 'Vercel → Account Settings → Tokens (escopo: sua conta pessoal)',
  },
  neon: {
    url: 'https://console.neon.tech/app/settings/api-keys',
    where: 'Neon → Account settings → API keys (chave pessoal)',
  },
}

const TONE: Record<string, string> = {
  ok: 'text-success',
  bad: 'text-error',
  busy: 'text-info',
  idle: 'text-neutral',
}

function Status(props: { tone: keyof typeof TONE; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-footnote whitespace-nowrap text-secondary">
      <span aria-hidden className={`text-caption ${TONE[props.tone]}`}>
        ●
      </span>
      {props.children}
    </span>
  )
}

const RENDER_STATUS: Record<string, [keyof typeof TONE, string]> = {
  live: ['ok', 'No ar'],
  deactivated: ['idle', 'Substituído'],
  build_failed: ['bad', 'Build falhou'],
  update_failed: ['bad', 'Atualização falhou'],
  pre_deploy_failed: ['bad', 'Pré-deploy falhou'],
  canceled: ['idle', 'Cancelado'],
  created: ['busy', 'Na fila'],
  build_in_progress: ['busy', 'Build em andamento'],
  update_in_progress: ['busy', 'Atualizando'],
  pre_deploy_in_progress: ['busy', 'Pré-deploy'],
}
const VERCEL_STATE: Record<string, [keyof typeof TONE, string]> = {
  READY: ['ok', 'Pronto'],
  ERROR: ['bad', 'Erro'],
  CANCELED: ['idle', 'Cancelado'],
  BUILDING: ['busy', 'Build em andamento'],
  INITIALIZING: ['busy', 'Iniciando'],
  QUEUED: ['busy', 'Na fila'],
}
const NEON_STATE: Record<string, [keyof typeof TONE, string]> = {
  ready: ['ok', 'Pronto'],
  init: ['busy', 'Criando'],
  archived: ['idle', 'Arquivado'],
}

function statusOf(map: Record<string, [keyof typeof TONE, string]>, key: string) {
  const [tone, label] = map[key] ?? ['idle', key]
  return <Status tone={tone}>{label}</Status>
}

/** Fetches one provider's resources and handles the not-connected and reconnect states. */
function ProviderSection<T>(props: {
  provider: Provider
  title: string
  children: (data: T) => ReactNode
}) {
  const state = useApi<{ connected: boolean } & T>(`/api/providers/${props.provider}/resources`)
  let body: ReactNode
  if (state.error === 409 || (state.data && !state.data.connected)) {
    body = (
      <p className="px-4 py-3 text-footnote text-secondary">
        {state.error === 409
          ? `${props.title} recusou a chave salva. `
          : `${props.title} não conectado. `}
        <Link to="/settings" className={inlineLink}>
          {state.error === 409 ? 'Reconectar em Configurações' : 'Conectar em Configurações'}
        </Link>
      </p>
    )
  } else if (state.error !== null) {
    body = (
      <p role="alert" className="px-4 py-3 text-footnote text-error">
        Não foi possível ler {props.title} (HTTP {state.error || 'rede'}).{' '}
        <button type="button" className="underline" onClick={state.reload}>
          Tentar de novo
        </button>
      </p>
    )
  } else if (!state.data) {
    body = <p className="px-4 py-3 text-footnote text-secondary">Carregando…</p>
  } else {
    body = props.children(state.data)
  }
  return (
    <Panel label={props.title}>
      <h2 className="border-b border-subtle px-4 py-2.5 text-footnote font-semibold">
        {props.title}
      </h2>
      {body}
    </Panel>
  )
}

const external = (href: string, children: ReactNode, where: string) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline">
    {children}
    <span className="sr-only"> (abre no {where})</span>
  </a>
)

interface RenderService {
  id: string
  name: string
  type: string
  url: string | null
  dashboardUrl: string
  suspended: boolean
  deploys: {
    id: string
    status: string
    sha: string | null
    message: string | null
    createdAt: string
  }[]
}

export function RenderPanel() {
  return (
    <ProviderSection<{ services: RenderService[] }> provider="render" title="Render">
      {({ services }) =>
        services.length === 0 ? (
          <p className="px-4 py-3 text-footnote text-secondary">Nenhum serviço no Render.</p>
        ) : (
          <ul>
            {services.map((s) => {
              const last = s.deploys[0]
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2 hover:bg-hover">
                  {s.suspended ? (
                    <Status tone="idle">Suspenso</Status>
                  ) : last ? (
                    statusOf(RENDER_STATUS, last.status)
                  ) : (
                    <Status tone="idle">Sem deploy</Status>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body">
                      {external(s.dashboardUrl, s.name, 'Render')}
                    </span>
                    <span className="block truncate font-mono text-caption text-secondary">
                      {[s.type, last?.sha, last?.message].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-caption text-secondary md:inline">
                    {formatDate(last?.createdAt ?? null)}
                  </span>
                </li>
              )
            })}
          </ul>
        )
      }
    </ProviderSection>
  )
}

interface VercelDeployment {
  id: string
  project: string
  url: string
  state: string
  target: string | null
  ref: string | null
  sha: string | null
  message: string | null
  createdAt: string
  inspectorUrl: string | null
}

export function VercelPanel() {
  return (
    <ProviderSection<{ deployments: VercelDeployment[] }> provider="vercel" title="Vercel">
      {({ deployments }) =>
        deployments.length === 0 ? (
          <p className="px-4 py-3 text-footnote text-secondary">Nenhum deployment na Vercel.</p>
        ) : (
          <ul>
            {deployments.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2 hover:bg-hover">
                {statusOf(VERCEL_STATE, d.state)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body">
                    {external(d.inspectorUrl ?? d.url, d.project, 'Vercel')}
                    <span className="text-secondary">
                      {' '}
                      · {d.target === 'production' ? 'Produção' : 'Preview'}
                    </span>
                  </span>
                  <span className="block truncate font-mono text-caption text-secondary">
                    {[d.ref, d.sha, d.message].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="hidden shrink-0 text-caption text-secondary md:inline">
                  {formatDate(d.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )
      }
    </ProviderSection>
  )
}

interface NeonProject {
  id: string
  name: string
  organization: string | null
  region: string
  pgVersion: number
  branches: {
    id: string
    name: string
    state: string
    isDefault: boolean
    logicalSize: number | null
  }[]
}

const mb = (bytes: number | null) =>
  bytes === null ? null : `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`

export function NeonPanel() {
  return (
    <ProviderSection<{ projects: NeonProject[] }> provider="neon" title="Neon (PostgreSQL)">
      {({ projects }) =>
        projects.length === 0 ? (
          <p className="px-4 py-3 text-footnote text-secondary">Nenhum projeto no Neon.</p>
        ) : (
          <ul>
            {projects.map((p) => (
              <li key={p.id} className="border-b border-subtle px-4 py-2.5 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-body font-medium">
                    {external(
                      `https://console.neon.tech/app/projects/${encodeURIComponent(p.id)}`,
                      p.name,
                      'Neon',
                    )}
                  </span>
                  <span className="font-mono text-caption text-secondary">
                    {[p.organization, p.region, `Postgres ${p.pgVersion}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {p.branches.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {p.branches.map((b) => (
                      <li key={b.id} className="flex items-center gap-3">
                        {statusOf(NEON_STATE, b.state)}
                        <span className="min-w-0 flex-1 truncate font-mono text-footnote">
                          {b.name}
                          {b.isDefault && <span className="text-secondary"> (padrão)</span>}
                        </span>
                        <span className="text-caption text-secondary">{mb(b.logicalSize)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )
      }
    </ProviderSection>
  )
}

function KeyRow(props: {
  provider: Provider
  label: string
  integration: Integration | null
  onChange: () => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const help = KEY_HELP[props.provider]
  const i = props.integration

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await request('PUT', `/api/providers/${props.provider}`, { token })
    setBusy(false)
    if (!res.ok) {
      setError(
        res.status === 400
          ? `${props.label} recusou a chave. Confira se copiou inteira.`
          : `Não foi possível salvar (HTTP ${res.status}).`,
      )
      return
    }
    setToken('')
    setOpen(false)
    props.onChange()
  }

  const disconnect = async () => {
    setBusy(true)
    await request('DELETE', `/api/providers/${props.provider}`)
    setBusy(false)
    props.onChange()
  }

  return (
    <li className="border-t border-subtle py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 text-body">
          {props.label}{' '}
          <span className="text-secondary">
            {!i
              ? 'não conectado'
              : i.status === 'connected'
                ? `conectado como ${i.externalLogin}`
                : `precisa reconectar (${i.externalLogin})`}
          </span>
        </span>
        {!open && (
          <button type="button" className={rowButton} onClick={() => setOpen(true)}>
            {i ? 'Trocar chave' : 'Conectar'}
          </button>
        )}
        {i && !open && (
          <button type="button" className={rowButton} disabled={busy} onClick={disconnect}>
            Desconectar
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-2 flex flex-col gap-2">
          <label htmlFor={id} className="text-footnote font-medium">
            Chave de API do {props.label}
          </label>
          <input
            id={id}
            type="password"
            autoComplete="off"
            spellCheck={false}
            required
            minLength={8}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className={`${inputClass} font-mono`}
          />
          <span className="text-caption text-secondary">
            Crie em{' '}
            <a href={help.url} target="_blank" rel="noreferrer" className="underline">
              {help.where}
              <span className="sr-only"> (abre em outra aba)</span>
            </a>
            . A chave fica cifrada no servidor e nunca volta para o navegador.
          </span>
          {error && (
            <p role="alert" className="text-footnote text-error">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className={primaryButton} disabled={busy}>
              {busy ? 'Verificando…' : 'Salvar chave'}
            </button>
            <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

/** Settings rows for the API-key providers. Disconnecting only forgets the key here. */
export function ProviderKeys() {
  const [rows, setRows] = useState<
    { provider: Provider; label: string; integration: Integration | null }[] | null
  >(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    void request<NonNullable<typeof rows>>('GET', '/api/providers').then((res) =>
      setRows(res.ok ? res.data : []),
    )
  }, [attempt])

  if (!rows) return null
  return (
    <>
      <ul className="mt-2.5">
        {rows.map((r) => (
          <KeyRow key={r.provider} {...r} onChange={() => setAttempt((n) => n + 1)} />
        ))}
      </ul>
      <p className="mt-1 text-caption text-secondary">
        Desconectar apaga a chave do DevHub. Para invalidá-la de vez, exclua no painel do provedor.
      </p>
    </>
  )
}
