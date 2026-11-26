import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'
import { listProjects, type Project } from '../projects/projects'
import {
  createMonitor,
  errorMessage,
  INTERVALS,
  listMonitors,
  ms,
  percent,
  STATE_META,
  type Monitor,
  type MonitorState,
} from './monitors'

export function StateBadge({ state, enabled = true }: { state: MonitorState; enabled?: boolean }) {
  const meta = enabled ? STATE_META[state] : { label: 'Pausado', color: 'text-offline' }
  return (
    <span className="inline-flex items-center gap-1.5 text-footnote text-secondary">
      <span className={`size-2 rounded-full bg-current ${meta.color}`} aria-hidden />
      {meta.label}
    </span>
  )
}

/** A value or an explicit "no data" marker; never a made-up zero. */
export function Observed({ value }: { value: string | null }) {
  return value === null ? (
    <span className="text-tertiary" title="Dados insuficientes">
      —
    </span>
  ) : (
    <span className="tabular">{value}</span>
  )
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let live = true
    void listMonitors().then((res) => {
      if (!live) return
      if (res.ok) setMonitors(res.data)
      else setLoadError(errorMessage(res.status))
    })
    return () => {
      live = false
    }
  }, [attempt])

  const down = (monitors ?? []).filter((m) => m.enabled && m.state === 'down').length

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
            Observabilidade
          </h1>
          <p className="mt-1 text-callout text-secondary">
            Monitores HTTP. Valores observados nas últimas 24 horas.
          </p>
        </div>
        {!creating && (
          <button type="button" className={primaryButton} onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> Novo monitor
          </button>
        )}
      </header>

      {creating && <CreateForm onCancel={() => setCreating(false)} />}

      {monitors && monitors.length > 0 && (
        <p role="status" className="mb-3 text-footnote text-secondary">
          {down > 0 ? (
            <span className="text-error">{down} fora do ar</span>
          ) : (
            'Nenhum monitor ativo fora do ar.'
          )}
        </p>
      )}

      <section
        aria-label="Monitores"
        className="overflow-x-auto rounded-surface border border-subtle bg-surface"
      >
        {loadError ? (
          <div className="p-6">
            <p role="alert" className="text-error">
              {loadError}
            </p>
            <button
              type="button"
              className={`${secondaryButton} mt-3`}
              onClick={() => {
                setLoadError(null)
                setAttempt((n) => n + 1)
              }}
            >
              Tentar de novo
            </button>
          </div>
        ) : monitors === null ? (
          <p className="p-6 text-secondary">Carregando monitores…</p>
        ) : monitors.length === 0 ? (
          <div className="p-6">
            <h2 className="text-headline">Nenhum monitor ainda</h2>
            <p className="mt-1 text-secondary">
              Adicione a URL de um endpoint público. O DevHub faz um GET no intervalo escolhido e
              registra status e latência.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-body">
            <thead className="border-b border-subtle text-footnote text-secondary">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Monitor
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Estado
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Uptime 24 h
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  P95
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">
                  Última verificação
                </th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((m) => (
                <tr key={m.id} className="border-b border-subtle last:border-0 hover:bg-hover">
                  <td className="max-w-0 px-4 py-3">
                    <Link
                      to={`/observability/${m.id}`}
                      className="block truncate font-medium text-primary hover:underline"
                    >
                      {m.name}
                    </Link>
                    <p className="truncate font-mono text-caption text-secondary">{m.url}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StateBadge state={m.state} enabled={m.enabled} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Observed value={percent(m.last24h.uptime)} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Observed value={ms(m.last24h.p95)} />
                  </td>
                  <td className="hidden px-4 py-3 text-footnote whitespace-nowrap text-secondary lg:table-cell">
                    {m.lastCheckedAt ? timeFormat.format(new Date(m.lastCheckedAt)) : 'Nunca'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="mt-2 text-caption text-secondary">
        — indica dados insuficientes: percentis exigem pelo menos 5 verificações bem-sucedidas.
      </p>
    </div>
  )
}

function CreateForm({ onCancel }: { onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const navigate = useNavigate()
  const id = useId()

  useEffect(() => {
    void listProjects().then((res) => {
      if (res.ok) setProjects(res.data.items.filter((p) => p.status !== 'archived'))
    })
  }, [])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const projectId = String(form.get('projectId') ?? '')
    setBusy(true)
    setError(null)
    const res = await createMonitor({
      name: String(form.get('name')),
      url: String(form.get('url')),
      intervalSeconds: Number(form.get('interval')),
      ...(projectId ? { projectId } : {}),
    })
    setBusy(false)
    if (!res.ok) return setError(errorMessage(res.status))
    void navigate(`/observability/${res.data.id}`)
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      aria-label="Novo monitor"
      className="mb-6 space-y-3 rounded-surface border border-subtle bg-surface p-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-name`} className="text-footnote font-medium">
            Nome
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={80}
            autoFocus
            className={`${inputClass} w-full`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-url`} className="text-footnote font-medium">
            URL
          </label>
          <input
            id={`${id}-url`}
            name="url"
            type="url"
            required
            placeholder="https://exemplo.com/health"
            className={`${inputClass} w-full font-mono`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-interval`} className="text-footnote font-medium">
            Intervalo
          </label>
          <select
            id={`${id}-interval`}
            name="interval"
            defaultValue={300}
            className={`${inputClass} block`}
          >
            {INTERVALS.map((i) => (
              <option key={i.seconds} value={i.seconds}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-project`} className="text-footnote font-medium">
            Projeto <span className="font-normal text-secondary">(opcional)</span>
          </label>
          <select
            id={`${id}-project`}
            name="projectId"
            defaultValue=""
            className={`${inputClass} block`}
          >
            <option value="">Nenhum</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-caption text-secondary">
        Endereços de rede privada (localhost, 10.x, 192.168.x…) são bloqueados por segurança.
      </p>
      <p role="alert" className="text-footnote text-error empty:hidden">
        {error}
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Criando…' : 'Criar monitor'}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
