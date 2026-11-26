import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Popover } from 'radix-ui'
import {
  CircleCheck,
  CircleSlash,
  CircleX,
  LoaderCircle,
  Pause,
  Play,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  activity,
  isFinal,
  useActivities,
  useActivityAnnouncement,
  type Activity,
  type ActivityStatus,
} from '../activity/store'

const statusMeta: Record<ActivityStatus, { label: string; icon: LucideIcon; color: string }> = {
  running: { label: 'Em andamento', icon: LoaderCircle, color: 'text-info' },
  paused: { label: 'Pausado', icon: Pause, color: 'text-pending' },
  completed: { label: 'Concluído', icon: CircleCheck, color: 'text-success' },
  failed: { label: 'Falhou', icon: CircleX, color: 'text-error' },
  cancelled: { label: 'Cancelado', icon: CircleSlash, color: 'text-neutral' },
}

/** Re-render every second while something is running, for elapsed time. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

function elapsed(a: Activity, now: number) {
  const s = Math.max(0, Math.round(((a.endedAt ?? now) - a.startedAt) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function StatusIcon({ status, size = 16 }: { status: ActivityStatus; size?: number }) {
  const { icon: Icon, color } = statusMeta[status]
  return (
    <Icon
      size={size}
      strokeWidth={2}
      aria-hidden
      className={`shrink-0 ${color} ${status === 'running' ? 'motion-safe:animate-spin' : ''}`}
    />
  )
}

/** Determinate only with a real value; otherwise an indeterminate bar (no invented %). */
function Progress({ a }: { a: Activity }) {
  if (a.status !== 'running' && a.status !== 'paused') return null
  const determinate = a.progress !== undefined
  return (
    <div
      role="progressbar"
      aria-label={a.title}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(a.progress! * 100) : undefined}
      className="relative h-1 overflow-hidden rounded-full bg-selected"
    >
      {determinate ? (
        <div
          className={`h-full rounded-full transition-[width] duration-(--dh-duration-normal) ${a.status === 'paused' ? 'bg-pending' : 'bg-brand'}`}
          style={{ width: `${a.progress! * 100}%` }}
        />
      ) : (
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-brand motion-safe:animate-indeterminate motion-reduce:w-full motion-reduce:opacity-40" />
      )}
    </div>
  )
}

/** The clicked control is about to disappear: after the re-render, focus the first control
 *  left in the list, or the main content when the shelf has closed. */
function keepFocusInList(from: HTMLElement) {
  const list = from.closest('ul')
  requestAnimationFrame(() => {
    const target =
      (list?.isConnected && list.querySelector<HTMLElement>('button, a')) ||
      document.getElementById('main')
    target?.focus()
  })
}

const smallButton =
  'inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-footnote text-secondary hover:bg-hover hover:text-primary'

function Row({ a, now, onNavigate }: { a: Activity; now: number; onNavigate: () => void }) {
  const meta = statusMeta[a.status]
  return (
    <li className="space-y-2 rounded-surface bg-hover p-3">
      <div className="flex items-start gap-2.5">
        <StatusIcon status={a.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-body font-medium">{a.title}</span>
            {a.simulated && (
              <span className="shrink-0 rounded-full border border-subtle px-1.5 text-caption text-secondary">
                Simulado
              </span>
            )}
          </div>
          <p className="truncate text-caption text-secondary">
            {[a.project, a.error ?? a.step ?? meta.label].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="shrink-0 font-mono text-caption text-secondary tabular">
          {a.progress !== undefined && !isFinal(a.status) && `${Math.round(a.progress * 100)}% · `}
          {elapsed(a, now)}
        </span>
      </div>
      <Progress a={a} />
      <div className="flex flex-wrap items-center gap-1">
        <span className={`mr-auto text-caption ${meta.color}`}>{meta.label}</span>
        {/* One element for pause/resume so keyboard focus survives the toggle. */}
        {a.controls?.pause && a.controls.resume && (
          <button
            type="button"
            className={smallButton}
            onClick={a.status === 'paused' ? a.controls.resume : a.controls.pause}
          >
            {a.status === 'paused' ? (
              <>
                <Play size={14} aria-hidden /> Retomar
              </>
            ) : (
              <>
                <Pause size={14} aria-hidden /> Pausar
              </>
            )}
          </button>
        )}
        {a.controls?.cancel && (
          <button
            type="button"
            className={smallButton}
            onClick={(e) => {
              keepFocusInList(e.currentTarget)
              a.controls?.cancel?.()
            }}
          >
            <X size={14} aria-hidden /> Cancelar
          </button>
        )}
        {a.detailsHref && (
          <Link to={a.detailsHref} className={smallButton} onClick={onNavigate}>
            Detalhes
          </Link>
        )}
        {isFinal(a.status) && (
          <button
            type="button"
            className={smallButton}
            onClick={(e) => {
              keepFocusInList(e.currentTarget)
              activity.dismiss(a.id)
            }}
            aria-label={`Remover ${a.title}`}
          >
            <X size={14} aria-hidden /> Remover
          </button>
        )}
      </div>
    </li>
  )
}

function Summary({ items, now }: { items: Activity[]; now: number }) {
  const active = items.filter((a) => !isFinal(a.status))
  const failed = items.filter((a) => a.status === 'failed').length
  const lead = active[0] ?? items[0]!
  if (items.length === 1 || active.length === 1) {
    return (
      <>
        <StatusIcon status={lead.status} />
        <span className="min-w-0 flex-1 truncate text-left">{lead.title}</span>
        <span className="shrink-0 font-mono text-caption text-secondary tabular">
          {lead.progress !== undefined && !isFinal(lead.status)
            ? `${Math.round(lead.progress * 100)}%`
            : elapsed(lead, now)}
        </span>
        {/* A failure must stay visible in the compact pill, not hide behind "+N". */}
        {failed > 0 && lead.status !== 'failed' ? (
          <span className="shrink-0 text-caption text-error">{failed} com falha</span>
        ) : (
          items.length > 1 && (
            <span className="shrink-0 text-caption text-secondary">+{items.length - 1}</span>
          )
        )}
      </>
    )
  }
  return (
    <>
      <StatusIcon status={active.length > 0 ? 'running' : failed > 0 ? 'failed' : 'completed'} />
      <span className="min-w-0 flex-1 truncate text-left">
        {active.length > 0
          ? `${active.length} operações em andamento`
          : `${items.length} operações`}
      </span>
      {failed > 0 && <span className="shrink-0 text-caption text-error">{failed} com falha</span>}
    </>
  )
}

/** Live operations (MASTER_PLAN §23). Hidden when there is nothing to show. */
export function ActivityShelf() {
  const items = useActivities()
  const announcement = useActivityAnnouncement()
  const [open, setOpen] = useState(false)
  const now = useNow(items.some((a) => !isFinal(a.status)))

  return (
    <>
      <span role="status" className="sr-only">
        {announcement}
      </span>
      {items.length > 0 && (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-(--dh-z-shelf) flex justify-center px-3">
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label="Atividades"
                className="dh-material-elevated pointer-events-auto flex h-11 w-[min(360px,100%)] items-center gap-2.5 rounded-full px-4 text-body"
              >
                <Summary items={items} now={now} />
              </button>
            </Popover.Trigger>
          </div>
          <Popover.Portal>
            <Popover.Content
              side="top"
              sideOffset={8}
              collisionPadding={8}
              aria-label="Atividades"
              className="dh-material-elevated z-(--dh-z-popover) w-[min(400px,calc(100vw-16px))] rounded-floating p-2 outline-none origin-(--radix-popover-content-transform-origin) data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
            >
              <h2 className="px-1.5 pt-1 pb-2 text-footnote font-semibold">Atividades</h2>
              <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
                {items.map((a) => (
                  <Row key={a.id} a={a} now={now} onNavigate={() => setOpen(false)} />
                ))}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </>
  )
}
