import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft, Pause, Play, RefreshCw, Trash2 } from 'lucide-react'
import { secondaryButton } from '../components/formStyles'
import {
  checkNow,
  deleteMonitor,
  ERROR_LABEL,
  errorMessage,
  getMonitor,
  INTERVALS,
  ms,
  percent,
  updateMonitor,
  type MonitorDetail as Detail,
} from './monitors'
import { Observed, StateBadge } from './MonitorsPage'

const timeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
const fmt = (iso: string) => timeFormat.format(new Date(iso))

export function MonitorDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [monitor, setMonitor] = useState<Detail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    void getMonitor(id).then((res) => {
      if (!live) return
      if (res.ok) setMonitor(res.data)
      else setLoadError(errorMessage(res.status === 400 ? 404 : res.status))
    })
    return () => {
      live = false
    }
  }, [id, attempt])

  async function act(run: () => Promise<{ ok: boolean; status: number }>, conflict?: string) {
    setBusy(true)
    setActionError(null)
    const res = await run()
    setBusy(false)
    if (!res.ok) {
      setActionError(res.status === 409 && conflict ? conflict : errorMessage(res.status))
      return false
    }
    setAttempt((n) => n + 1)
    return true
  }

  const back = (
    <Link
      to="/observability"
      className="mb-4 inline-flex items-center gap-1 text-footnote text-secondary hover:text-primary"
    >
      <ChevronLeft size={14} aria-hidden /> Observabilidade
    </Link>
  )

  if (loadError || !monitor) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
        {back}
        <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
          {loadError ? 'Monitor indisponível' : 'Carregando…'}
        </h1>
        {loadError && (
          <p role="alert" className="mt-2 text-secondary">
            {loadError}
          </p>
        )}
      </div>
    )
  }

  const interval = INTERVALS.find((i) => i.seconds === monitor.intervalSeconds)?.label
  const w = monitor.last24h
  const openIncident = monitor.incidents.find((i) => !i.resolvedAt)

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      {back}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 tabIndex={-1} data-page-title className="truncate text-title1 outline-none">
            {monitor.name}
          </h1>
          <p className="mt-1 truncate font-mono text-footnote text-secondary">{monitor.url}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-secondary">
            <StateBadge state={monitor.state} enabled={monitor.enabled} />
            <span>A cada {interval ?? `${monitor.intervalSeconds} s`}</span>
            {monitor.project && (
              <Link to={`/projects/${monitor.project.id}`} className="hover:underline">
                Projeto: {monitor.project.name}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className={secondaryButton}
            onClick={() =>
              void act(() => checkNow(id), 'Verificado há menos de 10 segundos. Aguarde.')
            }
          >
            <RefreshCw size={16} aria-hidden /> Verificar agora
          </button>
          <button
            type="button"
            disabled={busy}
            className={secondaryButton}
            onClick={() => void act(() => updateMonitor(id, { enabled: !monitor.enabled }))}
          >
            {monitor.enabled ? (
              <>
                <Pause size={16} aria-hidden /> Pausar
              </>
            ) : (
              <>
                <Play size={16} aria-hidden /> Retomar
              </>
            )}
          </button>
          {confirmDelete ? (
            <>
              <button
                type="button"
                disabled={busy}
                className={`${secondaryButton} text-error`}
                onClick={() =>
                  void act(() => deleteMonitor(id)).then(
                    (ok) => ok && void navigate('/observability'),
                  )
                }
              >
                <Trash2 size={16} aria-hidden /> Confirmar exclusão
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} aria-hidden /> Excluir
            </button>
          )}
        </div>
      </header>
      {confirmDelete && (
        <p className="-mt-3 mb-4 text-footnote text-secondary">
          A exclusão apaga o monitor, o histórico de verificações e os incidentes. Não pode ser
          desfeita.
        </p>
      )}
      <p role="alert" className="mb-4 text-footnote text-error empty:hidden">
        {actionError}
      </p>

      {openIncident && (
        <p className="mb-4 rounded-surface border border-error/40 bg-surface px-4 py-3 text-body">
          <span className="font-medium text-error">Incidente aberto</span> desde{' '}
          {fmt(openIncident.openedAt)} · {ERROR_LABEL[openIncident.cause] ?? openIncident.cause}
        </p>
      )}

      <section aria-labelledby="window-title" className="mb-8">
        <h2 id="window-title" className="mb-2 text-footnote font-medium text-secondary">
          Observado nas últimas 24 horas
        </h2>
        <dl className="grid grid-cols-2 divide-subtle rounded-surface border border-subtle bg-surface md:grid-cols-4 md:divide-x">
          {[
            ['Uptime', percent(w.uptime)],
            ['P50', ms(w.p50)],
            ['P95', ms(w.p95)],
            ['Verificações', String(w.checks)],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-3">
              <dt className="text-caption text-secondary">{label}</dt>
              <dd className="mt-0.5 text-title3">
                <Observed value={value ?? null} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="checks-title" className="mb-8">
        <h2 id="checks-title" className="mb-2 text-headline">
          Verificações recentes
        </h2>
        {monitor.recentChecks.length === 0 ? (
          <p className="text-secondary">
            Nenhuma verificação ainda. A primeira roda em até 15 segundos, ou use “Verificar agora”.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-surface border border-subtle bg-surface">
            <table className="w-full text-left text-body">
              <thead className="border-b border-subtle text-footnote text-secondary">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Horário
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Resultado
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    HTTP
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Latência
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono text-footnote">
                {monitor.recentChecks.map((c) => (
                  <tr key={c.id} className="border-b border-subtle last:border-0">
                    <td className="px-4 py-2 whitespace-nowrap text-secondary">
                      {fmt(c.checkedAt)}
                    </td>
                    <td className={`px-4 py-2 font-sans ${c.ok ? 'text-success' : 'text-error'}`}>
                      {c.ok ? 'OK' : (ERROR_LABEL[c.error ?? ''] ?? 'Falha')}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Observed value={c.statusCode === null ? null : String(c.statusCode)} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Observed value={ms(c.latencyMs)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="incidents-title">
        <h2 id="incidents-title" className="mb-2 text-headline">
          Incidentes
        </h2>
        {monitor.incidents.length === 0 ? (
          <p className="text-secondary">
            Nenhum incidente. Um incidente abre após 2 falhas seguidas e fecha na próxima
            verificação bem-sucedida.
          </p>
        ) : (
          <ul className="divide-y divide-subtle rounded-surface border border-subtle bg-surface">
            {monitor.incidents.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <span>{ERROR_LABEL[i.cause] ?? i.cause}</span>
                <span className="text-footnote text-secondary">
                  {fmt(i.openedAt)} → {i.resolvedAt ? fmt(i.resolvedAt) : 'em aberto'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
