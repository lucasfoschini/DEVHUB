import { Link } from 'react-router'
import {
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { secondaryButton } from '../components/formStyles'
import { Loadable, PageShell, Panel } from '../components/page'
import { formatDate, inlineLink, useApi } from '../components/page-utils'
import { RenderPanel, VercelPanel } from '../providers/ProviderPanels'

interface Run {
  id: number
  workflow: string
  title: string
  branch: string | null
  sha: string
  event: string
  status: string
  conclusion: string | null
  url: string
  createdAt: string
  updatedAt: string
}
interface Deployment {
  id: number
  environment: string
  ref: string
  sha: string
  createdAt: string
  state: string | null
}
interface Pipeline {
  repository: { id: string; fullName: string }
  runs: Run[]
  deployments: Deployment[]
  error: number | null
}

type Tone = { label: string; icon: LucideIcon; color: string; spin?: boolean }

/** GitHub's run status/conclusion and deployment state, in Portuguese. */
function runTone(r: Run): Tone {
  if (r.status !== 'completed') {
    return r.status === 'queued' || r.status === 'waiting' || r.status === 'pending'
      ? { label: 'Na fila', icon: CircleDashed, color: 'text-pending' }
      : { label: 'Em execução', icon: LoaderCircle, color: 'text-info', spin: true }
  }
  if (r.conclusion === 'success')
    return { label: 'Sucesso', icon: CircleCheck, color: 'text-success' }
  if (
    r.conclusion === 'failure' ||
    r.conclusion === 'timed_out' ||
    r.conclusion === 'startup_failure'
  )
    return { label: 'Falhou', icon: CircleX, color: 'text-error' }
  if (r.conclusion === 'cancelled')
    return { label: 'Cancelado', icon: CircleSlash, color: 'text-neutral' }
  return { label: r.conclusion ?? 'Concluído', icon: CircleDashed, color: 'text-neutral' }
}

const DEPLOY_STATE: Record<string, Tone> = {
  success: { label: 'Ativo', icon: CircleCheck, color: 'text-success' },
  failure: { label: 'Falhou', icon: CircleX, color: 'text-error' },
  error: { label: 'Erro', icon: CircleX, color: 'text-error' },
  in_progress: { label: 'Em andamento', icon: LoaderCircle, color: 'text-info', spin: true },
  queued: { label: 'Na fila', icon: CircleDashed, color: 'text-pending' },
  pending: { label: 'Pendente', icon: CircleDashed, color: 'text-pending' },
  inactive: { label: 'Substituído', icon: CircleSlash, color: 'text-neutral' },
}
const UNKNOWN: Tone = { label: 'Sem status', icon: CircleDashed, color: 'text-neutral' }

function ToneLabel({ tone }: { tone: Tone }) {
  const Icon = tone.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-footnote whitespace-nowrap text-secondary">
      <Icon
        size={14}
        aria-hidden
        className={`${tone.color} ${tone.spin ? 'motion-safe:animate-spin' : ''}`}
      />
      {tone.label}
    </span>
  )
}

function PipelineCard({ p }: { p: Pipeline }) {
  return (
    <Panel label={p.repository.fullName} className="motion-safe:animate-rise-in">
      <h2 className="border-b border-subtle px-4 py-2.5 font-mono text-footnote font-semibold">
        {p.repository.fullName}
      </h2>
      {p.error !== null ? (
        <p className="px-4 py-3 text-footnote text-secondary">
          O GitHub recusou a leitura (HTTP {p.error}): Actions pode estar desativado ou o escopo
          concedido não cobre este repositório.
        </p>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            <h3 className="px-4 pt-3 pb-1 text-caption font-semibold text-secondary">
              Workflows recentes
            </h3>
            {p.runs.length === 0 ? (
              <p className="px-4 pb-3 text-footnote text-secondary">Nenhuma execução de Actions.</p>
            ) : (
              <ul>
                {p.runs.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2 hover:bg-hover">
                    <ToneLabel tone={runTone(r)} />
                    <span className="min-w-0 flex-1">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-body underline"
                      >
                        {r.workflow}: {r.title}
                        <span className="sr-only"> (abre no GitHub)</span>
                      </a>
                      <span className="block truncate font-mono text-caption text-secondary">
                        {[r.branch, r.sha, r.event].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-caption text-secondary md:inline">
                      {formatDate(r.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-subtle lg:border-t-0 lg:border-l">
            <h3 className="px-4 pt-3 pb-1 text-caption font-semibold text-secondary">
              Deployments (GitHub)
            </h3>
            {p.deployments.length === 0 ? (
              <p className="px-4 pb-3 text-footnote text-secondary">
                Nenhum deployment registrado.
              </p>
            ) : (
              <ul>
                {p.deployments.map((d) => (
                  <li key={d.id} className="px-4 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-body font-medium">{d.environment}</span>
                      <ToneLabel tone={(d.state && DEPLOY_STATE[d.state]) || UNKNOWN} />
                    </div>
                    <span className="block font-mono text-caption text-secondary">
                      {d.ref} · {d.sha} · {formatDate(d.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}

/** Deploy Center (MASTER_PLAN §7.4), read-only: GitHub Actions runs and GitHub Deployments of
 *  the imported repositories. Triggering deploys waits for a provider integration (Phase 4). */
export function DeploymentsPage() {
  const state = useApi<{ connected: boolean; pipelines: Pipeline[] }>('/api/deployments')

  return (
    <PageShell
      title="Deployments"
      subtitle="Deploys do Render e da Vercel e pipelines do GitHub, somente leitura (cache de 60 s)."
      wide
      action={
        <button type="button" className={secondaryButton} onClick={state.reload}>
          <RefreshCw size={16} aria-hidden /> Atualizar
        </button>
      }
    >
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <RenderPanel />
        <VercelPanel />
      </div>
      <h2 className="mb-3 text-headline">GitHub</h2>
      <Loadable state={state} what="os deployments">
        {({ connected, pipelines }) =>
          !connected ? (
            <Panel className="p-6">
              <h2 className="text-headline">GitHub não conectado</h2>
              <p className="mt-1 text-secondary">
                Conecte o GitHub e importe repositórios no{' '}
                <Link to="/git" className={inlineLink}>
                  Git Center
                </Link>{' '}
                para ver workflows e deployments.
              </p>
            </Panel>
          ) : pipelines.length === 0 ? (
            <Panel className="p-6">
              <h2 className="text-headline">Nenhum repositório importado</h2>
              <p className="mt-1 text-secondary">
                Importe repositórios no{' '}
                <Link to="/git" className={inlineLink}>
                  Git Center
                </Link>
                .
              </p>
            </Panel>
          ) : (
            <div className="space-y-4">
              {pipelines.map((p) => (
                <PipelineCard key={p.repository.id} p={p} />
              ))}
              <p className="flex items-center gap-1 text-caption text-secondary">
                <ExternalLink size={12} aria-hidden /> Links abrem no GitHub. Até 10 repositórios, 5
                execuções cada.
              </p>
            </div>
          )
        }
      </Loadable>
    </PageShell>
  )
}
