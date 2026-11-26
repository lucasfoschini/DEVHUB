import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { secondaryButton } from '../components/formStyles'
import { ERROR_LABEL } from '../monitors/monitors'
import { StatusBadge } from '../projects/ProjectsPage'
import { STATUSES, type ProjectStatus } from '../projects/projects'
import { request } from '../session'

interface Overview {
  projects: {
    byStatus: Partial<Record<ProjectStatus, number>>
    recent: { id: string; name: string; status: ProjectStatus; updatedAt: string }[]
  }
  monitors: { total: number; up: number; down: number; unknown: number; paused: number }
  openIncidents: {
    id: string
    cause: string
    openedAt: string
    monitor: { id: string; name: string; project: { id: string; name: string } | null }
  }[]
  recentPushes: { id: string; fullName: string; pushedAt: string; lastSyncAt: string }[]
  github: { status: 'connected' | 'needs_reconnect'; externalLogin: string } | null
  unreadNotifications: number
}

const REFRESH_MS = 30_000
const timeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const formatTime = (iso: string) => timeFormat.format(new Date(iso))

function Metric(props: { label: string; value: number; tone?: string; to: string }) {
  return (
    <Link to={props.to} className="flex min-w-32 flex-1 flex-col gap-0.5 px-4 py-3 hover:bg-hover">
      <span className="text-footnote text-secondary">{props.label}</span>
      <span className={`text-title2 tabular ${props.tone ?? ''}`}>{props.value}</span>
    </Link>
  )
}

function Section(props: { title: string; action?: ReactNode; children: ReactNode }) {
  const id = `ov-${props.title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section aria-labelledby={id} className="mt-8">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-headline">
          {props.title}
        </h2>
        {props.action}
      </div>
      <div className="rounded-surface border border-subtle bg-surface">{props.children}</div>
    </section>
  )
}

const rowClass = 'flex items-center gap-3 border-b border-subtle px-4 py-2.5 last:border-0'
const moreLink = 'text-footnote text-secondary underline hover:text-primary'

/** Command Center (MASTER_PLAN §7.1): what works, what fails, what changed. Real data only;
 *  modules not built yet (deploys, agents, AI) are absent rather than simulated. */
export function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    const load = () =>
      request<Overview>('GET', '/api/overview').then((res) => {
        if (!live) return
        setFailed(!res.ok)
        if (res.ok) setData(res.data)
      })
    void load()
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), REFRESH_MS)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [attempt])

  const active = data
    ? STATUSES.filter((s) => s !== 'archived').reduce(
        (n, s) => n + (data.projects.byStatus[s] ?? 0),
        0,
      )
    : 0

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
          Visão geral
        </h1>
        <p className="mt-1 text-callout text-secondary">
          O que está funcionando, o que está falhando e o que mudou.
        </p>
      </header>

      {failed && !data ? (
        <div className="rounded-surface border border-subtle bg-surface p-6">
          <p role="alert" className="text-error">
            Não foi possível carregar a visão geral.
          </p>
          <button
            type="button"
            className={`${secondaryButton} mt-3`}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Tentar de novo
          </button>
        </div>
      ) : !data ? (
        <p className="text-secondary">Carregando…</p>
      ) : (
        <>
          <div
            role="group"
            aria-label="Resumo"
            className="flex flex-wrap divide-x divide-subtle overflow-hidden rounded-surface border border-subtle bg-surface"
          >
            <Metric
              label="Fora do ar"
              value={data.monitors.down}
              tone={data.monitors.down > 0 ? 'text-error' : undefined}
              to="/observability"
            />
            <Metric label="Operacionais" value={data.monitors.up} to="/observability" />
            <Metric
              label="Incidentes abertos"
              value={data.openIncidents.length}
              tone={data.openIncidents.length > 0 ? 'text-error' : undefined}
              to="/observability"
            />
            <Metric label="Projetos ativos" value={active} to="/projects" />
          </div>

          <Section title="Precisa de atenção">
            <ul>
              {data.github?.status === 'needs_reconnect' && (
                <li className={rowClass}>
                  <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    GitHub recusou o token de @{data.github.externalLogin}
                  </span>
                  <Link to="/git" className={moreLink}>
                    Reconectar
                  </Link>
                </li>
              )}
              {data.openIncidents.map((i) => (
                <li key={i.id} className={rowClass}>
                  <span className="size-2 shrink-0 rounded-full bg-error" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <Link
                      to={`/observability/${i.monitor.id}`}
                      className="block truncate font-medium text-primary underline"
                    >
                      {i.monitor.name}
                    </Link>
                    <span className="block truncate text-caption text-secondary">
                      {[ERROR_LABEL[i.cause] ?? i.cause, i.monitor.project?.name]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-footnote text-secondary">
                    desde {formatTime(i.openedAt)}
                  </span>
                </li>
              ))}
              {data.openIncidents.length === 0 && data.github?.status !== 'needs_reconnect' && (
                <li className="px-4 py-3 text-secondary">
                  {data.monitors.total === 0
                    ? 'Nenhum monitor configurado: não há como saber o que está fora do ar.'
                    : 'Nada falhando agora.'}
                </li>
              )}
            </ul>
          </Section>

          <div className="grid gap-x-6 lg:grid-cols-2">
            <Section
              title="Projetos recentes"
              action={
                <Link to="/projects" className={moreLink}>
                  Ver todos
                </Link>
              }
            >
              {data.projects.recent.length === 0 ? (
                <p className="px-4 py-3 text-secondary">Nenhum projeto ativo.</p>
              ) : (
                <ul>
                  {data.projects.recent.map((p) => (
                    <li key={p.id} className={rowClass}>
                      <Link
                        to={`/projects/${p.id}`}
                        className="min-w-0 flex-1 truncate font-medium text-primary underline"
                      >
                        {p.name}
                      </Link>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Atividade Git"
              action={
                <Link to="/git" className={moreLink}>
                  Git Center
                </Link>
              }
            >
              {data.recentPushes.length === 0 ? (
                <p className="px-4 py-3 text-secondary">
                  {data.github ? 'Nenhum repositório importado.' : 'GitHub não conectado.'}
                </p>
              ) : (
                <ul>
                  {data.recentPushes.map((r) => (
                    <li key={r.id} className={rowClass}>
                      <span className="min-w-0 flex-1 truncate font-mono text-footnote">
                        {r.fullName}
                      </span>
                      <span className="shrink-0 text-footnote text-secondary">
                        push {formatTime(r.pushedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
          {data.recentPushes.length > 0 && (
            <p className="mt-2 text-caption text-secondary">
              Datas de push lidas do GitHub na última importação ou sincronização de cada
              repositório.
            </p>
          )}
        </>
      )}
    </div>
  )
}
