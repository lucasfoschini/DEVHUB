import { useState } from 'react'
import { Link } from 'react-router'
import { Segmented } from '../components/Segmented'
import { Loadable, PageShell, Panel } from '../components/page'
import { useApi } from '../components/page-utils'
import { Observed } from '../monitors/MonitorsPage'
import { percent } from '../monitors/monitors'

interface Analytics {
  days: number
  daily: { day: string; checks: number; uptime: number | null; p95: number | null }[]
  incidents: { opened: number; resolved: number; mttrSeconds: number | null }
  monitors: { id: string; name: string; checks: number; uptime: number | null }[]
}

type Point = { day: string; value: number | null }

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** Every UTC day in the window, so days without checks show as gaps, not as zero. */
function fillDays(days: number, rows: Analytics['daily']) {
  const byDay = new Map(rows.map((r) => [r.day, r]))
  const today = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1 - i)),
    )
    const key = d.toISOString().slice(0, 10)
    return { day: key, row: byDay.get(key) ?? null }
  })
}

function duration(seconds: number | null) {
  if (seconds === null) return null
  if (seconds < 60) return `${Math.round(seconds)} s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  return `${(seconds / 3600).toFixed(1)} h`
}

const W = 640
const H = 180
const PAD = { top: 12, right: 8, bottom: 24, left: 44 }

/** One-series daily chart (bar or line) with a recessive grid, hover/focus tooltip per day and
 *  a table view. Missing days are gaps, never drawn as zero. */
function DailyChart(props: {
  title: string
  kind: 'bar' | 'line'
  points: Point[]
  max: number
  ticks: number[]
  format: (v: number) => string
}) {
  const [active, setActive] = useState<number | null>(null)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const step = innerW / props.points.length
  const x = (i: number) => PAD.left + step * i + step / 2
  const y = (v: number) => PAD.top + innerH - (Math.min(v, props.max) / props.max) * innerH
  const barW = Math.max(2, Math.min(18, step - 2))
  const labelEvery = Math.ceil(props.points.length / 8)
  const linePath = props.points
    .map((p, i) => (p.value === null ? null : `${x(i)},${y(p.value)}`))
    .reduce<string[][]>(
      (segs, pt) => {
        if (pt === null) segs.push([])
        else segs[segs.length - 1]!.push(pt)
        return segs
      },
      [[]],
    )
    .filter((s) => s.length > 0)
  const hovered = active === null ? null : props.points[active]!

  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-headline">{props.title}</figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`${props.title}. Tabela com os valores abaixo.`}
          onMouseLeave={() => setActive(null)}
        >
          {props.ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-subtle"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-secondary text-[11px] tabular"
              >
                {props.format(t)}
              </text>
            </g>
          ))}
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              className="stroke-control"
              strokeWidth={1}
            />
          )}
          {props.kind === 'bar'
            ? props.points.map((p, i) =>
                p.value === null ? null : (
                  <path
                    key={p.day}
                    // 4px rounded data-end, square at the baseline.
                    d={(() => {
                      const top = y(p.value)
                      const base = PAD.top + innerH
                      const r = Math.min(4, barW / 2, base - top)
                      const l = x(i) - barW / 2
                      return `M${l},${base}V${top + r}Q${l},${top} ${l + r},${top}H${l + barW - r}Q${l + barW},${top} ${l + barW},${top + r}V${base}Z`
                    })()}
                    className={`fill-brand transition-opacity duration-(--dh-duration-fast) ${active !== null && active !== i ? 'opacity-50' : ''}`}
                  />
                ),
              )
            : linePath.map((seg, i) => (
                <polyline
                  key={i}
                  points={seg.join(' ')}
                  fill="none"
                  className="stroke-brand"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
          {props.kind === 'line' &&
            props.points.map((p, i) =>
              p.value === null ? null : (
                <circle
                  key={p.day}
                  cx={x(i)}
                  cy={y(p.value)}
                  r={active === i ? 5 : 4}
                  className="fill-brand stroke-surface"
                  strokeWidth={2}
                />
              ),
            )}
          {props.points.map((p, i) => (
            <g key={p.day}>
              {i % labelEvery === 0 && (
                <text
                  x={x(i)}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-secondary text-[11px] tabular"
                >
                  {dayLabel(p.day)}
                </text>
              )}
              {/* Hit target: the whole day column, larger than the mark. */}
              <rect
                x={PAD.left + step * i}
                y={PAD.top}
                width={step}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
              />
            </g>
          ))}
        </svg>
        {hovered && (
          <div
            aria-hidden
            className="dh-material-elevated pointer-events-none absolute top-0 z-(--dh-z-popover) rounded-control px-2.5 py-1.5 text-footnote whitespace-nowrap"
            style={{
              left: `${(x(active!) / W) * 100}%`,
              transform: `translateX(${x(active!) > W / 2 ? 'calc(-100% - 8px)' : '8px'})`,
            }}
          >
            <span className="block text-caption text-secondary">{dayLabel(hovered.day)} (UTC)</span>
            <span className="tabular">
              {hovered.value === null ? 'Sem dados' : props.format(hovered.value)}
            </span>
          </div>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-footnote text-secondary">Ver tabela</summary>
        <table className="mt-2 w-full max-w-sm text-left text-footnote">
          <thead className="text-caption text-secondary">
            <tr>
              <th scope="col" className="py-1 font-medium">
                Dia (UTC)
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {props.points.map((p) => (
              <tr key={p.day} className="border-t border-subtle">
                <td className="py-1">{dayLabel(p.day)}</td>
                <td className="py-1 text-right tabular">
                  {p.value === null ? '—' : props.format(p.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function Stat(props: { label: string; value: string | null; hint?: string }) {
  return (
    <div className="flex min-w-36 flex-1 flex-col gap-0.5 px-4 py-3">
      <span className="text-footnote text-secondary">{props.label}</span>
      <span className="text-title2">
        <Observed value={props.value} />
      </span>
      {props.hint && <span className="text-caption text-secondary">{props.hint}</span>}
    </div>
  )
}

/** Analytics (MASTER_PLAN §7.11): uptime, latency and incident figures computed from the
 *  checks DevHub actually ran. Days in UTC; "—" means not enough data. */
export function AnalyticsPage() {
  const [days, setDays] = useState<'7' | '30'>('7')
  const state = useApi<Analytics>(`/api/analytics?days=${days}`)

  return (
    <PageShell
      title="Analytics"
      subtitle="Disponibilidade, latência e incidentes medidos pelos seus monitores."
      action={
        <div className="w-48">
          <Segmented<'7' | '30'>
            label="Período"
            hideLabel
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '7 dias' },
              { value: '30', label: '30 dias' },
            ]}
          />
        </div>
      }
    >
      <Loadable state={state} what="os indicadores">
        {(a) => {
          const filled = fillDays(a.days, a.daily)
          const checks = a.daily.reduce((n, d) => n + d.checks, 0)
          const okChecks = a.daily.reduce((n, d) => n + (d.uptime ?? 0) * d.checks, 0)
          return checks === 0 && a.monitors.length === 0 ? (
            <Panel className="p-6">
              <h2 className="text-headline">Sem dados ainda</h2>
              <p className="mt-1 text-secondary">
                Os indicadores vêm das verificações dos monitores.{' '}
                <Link to="/observability" className="underline">
                  Crie um monitor
                </Link>{' '}
                e volte depois das primeiras verificações.
              </p>
            </Panel>
          ) : (
            <div className="space-y-6">
              <div
                role="group"
                aria-label="Resumo do período"
                className="flex flex-wrap divide-x divide-subtle rounded-surface border border-subtle bg-surface"
              >
                <Stat
                  label="Disponibilidade"
                  value={checks === 0 ? null : percent(okChecks / checks)}
                  hint={`${checks} verificações`}
                />
                <Stat label="Incidentes abertos" value={String(a.incidents.opened)} />
                <Stat label="Resolvidos" value={String(a.incidents.resolved)} />
                <Stat
                  label="Tempo médio de recuperação"
                  value={duration(a.incidents.mttrSeconds)}
                />
              </div>
              <Panel className="p-4 md:p-5">
                <DailyChart
                  title="Disponibilidade por dia"
                  kind="bar"
                  points={filled.map((f) => ({ day: f.day, value: f.row?.uptime ?? null }))}
                  max={1}
                  ticks={[0, 0.5, 1]}
                  format={(v) => `${Math.round(v * 1000) / 10}%`}
                />
              </Panel>
              <Panel className="p-4 md:p-5">
                {(() => {
                  const points = filled.map((f) => ({ day: f.day, value: f.row?.p95 ?? null }))
                  const peak = Math.max(0, ...points.map((p) => p.value ?? 0))
                  const max = peak <= 0 ? 100 : Math.ceil(peak / 100) * 100
                  return (
                    <DailyChart
                      title="Latência P95 por dia (respostas com sucesso)"
                      kind="line"
                      points={points}
                      max={max}
                      ticks={[0, max / 2, max]}
                      format={(v) => `${Math.round(v)} ms`}
                    />
                  )
                })()}
              </Panel>
              <Panel label="Por monitor">
                <table className="w-full text-left text-body">
                  <thead className="border-b border-subtle text-footnote text-secondary">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        Monitor
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        Verificações
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">
                        Disponibilidade
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.monitors.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-subtle last:border-0 hover:bg-hover"
                      >
                        <td className="px-4 py-2.5">
                          <Link to={`/observability/${m.id}`} className="underline">
                            {m.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular">{m.checks}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Observed value={percent(m.uptime)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
              <p className="text-caption text-secondary">
                Dias em UTC. Verificações são mantidas por 30 dias. P95 exige ao menos 5 respostas
                com sucesso no dia.
              </p>
            </div>
          )
        }}
      </Loadable>
    </PageShell>
  )
}
