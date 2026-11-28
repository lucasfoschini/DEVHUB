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

interface LogLine {
  id: string
  at: string
  level: string | null
  source: string | null
  text: string
}

const timeOnly = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' })

/** Read-only detail under a row, loaded only while open. Data content: solid surface. */
function Detail<T>(props: { path: string; label: string; children: (data: T) => ReactNode }) {
  const state = useApi<{ connected: boolean } & T>(props.path)
  return (
    <div className="mx-4 mb-2 rounded-control border border-subtle bg-surface">
      {state.error !== null ? (
        <p role="alert" className="px-3 py-2 text-footnote text-error">
          Não foi possível ler {props.label} (HTTP {state.error || 'rede'}).{' '}
          <button type="button" className="underline" onClick={state.reload}>
            Tentar de novo
          </button>
        </p>
      ) : !state.data ? (
        <p className="px-3 py-2 text-footnote text-secondary">Carregando…</p>
      ) : (
        props.children(state.data)
      )}
    </div>
  )
}

function Lines(props: { path: string; label: string }) {
  return (
    <Detail<{ lines: LogLine[] }> path={props.path} label={props.label}>
      {({ lines }) =>
        lines.length === 0 ? (
          <p className="px-3 py-2 text-footnote text-secondary">Nenhuma linha no período.</p>
        ) : (
          <ol
            tabIndex={0}
            aria-label={props.label}
            className="max-h-72 overflow-auto px-3 py-2 font-mono text-caption"
          >
            {lines.map((l) => (
              <li
                key={l.id}
                className={`whitespace-pre-wrap break-all ${l.level === 'error' ? 'text-error' : ''}`}
              >
                <span className="text-secondary">{timeOnly.format(new Date(l.at))} </span>
                {l.text}
              </li>
            ))}
          </ol>
        )
      }
    </Detail>
  )
}

interface Series {
  labels: Record<string, string>
  unit: string | null
  values: { at: string; value: number }[]
}

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/** Last, min and max of each series Render returns for the last hour. Units are shown as
 *  Render sends them; nothing is converted. */
function Metrics(props: { id: string }) {
  return (
    <Detail<{ cpu: Series[]; memory: Series[]; requests: Series[] }>
      path={`/api/providers/render/services/${encodeURIComponent(props.id)}/metrics`}
      label="métricas do Render"
    >
      {(m) => (
        <table className="w-full text-footnote">
          <caption className="px-3 pt-2 text-left text-caption text-secondary">
            Última hora, passos de 5 minutos
          </caption>
          <thead className="text-left text-caption text-secondary">
            <tr>
              <th className="px-3 py-1 font-medium">Métrica</th>
              <th className="px-3 py-1 font-medium">Última</th>
              <th className="px-3 py-1 font-medium">Mín.</th>
              <th className="px-3 py-1 font-medium">Máx.</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {(
              [
                ['CPU', m.cpu],
                ['Memória', m.memory],
                ['Requisições HTTP', m.requests],
              ] as const
            ).flatMap(([name, series]) => {
              const rows = series.length ? series : [null]
              return rows.map((s, i) => {
                const v = s?.values.map((x) => x.value) ?? []
                const tag = s && Object.values(s.labels).join(' · ')
                const fmt = (n: number | undefined) =>
                  n === undefined ? '—' : `${number.format(n)}${s?.unit ? ` ${s.unit}` : ''}`
                return (
                  <tr key={`${name}-${i}`} className="border-t border-subtle">
                    <td className="px-3 py-1 font-sans">
                      {name}
                      {tag && <span className="text-secondary"> ({tag})</span>}
                    </td>
                    <td className="px-3 py-1">{fmt(v.at(-1))}</td>
                    <td className="px-3 py-1">{fmt(v.length ? Math.min(...v) : undefined)}</td>
                    <td className="px-3 py-1">{fmt(v.length ? Math.max(...v) : undefined)}</td>
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      )}
    </Detail>
  )
}

/** Toggle buttons for a row's details; only one is open at a time. */
function useDetailToggle<K extends string>() {
  const [open, setOpen] = useState<K | null>(null)
  const toggle = (k: K, label: string) => (
    <button
      type="button"
      className={rowButton}
      aria-expanded={open === k}
      onClick={() => setOpen(open === k ? null : k)}
    >
      {label}
    </button>
  )
  return [open, toggle] as const
}

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

function RenderRow({ service: s }: { service: RenderService }) {
  const [open, toggle] = useDetailToggle<'logs' | 'metrics'>()
  const last = s.deploys[0]
  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-2 hover:bg-hover">
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
        {toggle('logs', 'Logs')}
        {toggle('metrics', 'Métricas')}
      </div>
      {open === 'logs' && (
        <Lines
          path={`/api/providers/render/services/${encodeURIComponent(s.id)}/logs`}
          label={`Logs de ${s.name}`}
        />
      )}
      {open === 'metrics' && <Metrics id={s.id} />}
    </li>
  )
}

export function RenderPanel() {
  return (
    <ProviderSection<{ services: RenderService[] }> provider="render" title="Render">
      {({ services }) =>
        services.length === 0 ? (
          <p className="px-4 py-3 text-footnote text-secondary">Nenhum serviço no Render.</p>
        ) : (
          <ul>
            {services.map((s) => (
              <RenderRow key={s.id} service={s} />
            ))}
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

function VercelRow({ deployment: d }: { deployment: VercelDeployment }) {
  const [open, toggle] = useDetailToggle<'build'>()
  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-2 hover:bg-hover">
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
        {toggle('build', 'Build')}
      </div>
      {open === 'build' && (
        <Lines
          path={`/api/providers/vercel/deployments/${encodeURIComponent(d.id)}/events`}
          label={`Build de ${d.project}`}
        />
      )}
    </li>
  )
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
              <VercelRow key={d.id} deployment={d} />
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
