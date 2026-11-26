import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Popover } from 'radix-ui'
import { Bell, CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import { desktop } from '../desktop/bridge'
import { request } from '../session'
import { ERROR_LABEL } from '../monitors/monitors'

type Severity = 'info' | 'success' | 'warning' | 'critical'

interface Notification {
  id: string
  kind: string
  severity: Severity
  title: string
  body: string
  href: string | null
  readAt: string | null
  createdAt: string
}

const POLL_MS = 30_000

const SEVERITY: Record<Severity, { icon: LucideIcon; color: string; label: string }> = {
  info: { icon: Info, color: 'text-info', label: 'Informação' },
  success: { icon: CircleCheck, color: 'text-success', label: 'Resolvido' },
  warning: { icon: TriangleAlert, color: 'text-warning', label: 'Atenção' },
  critical: { icon: CircleAlert, color: 'text-error', label: 'Crítico' },
}

const timeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Monitor causes arrive machine-readable; everything else is already human text. */
const bodyText = (n: Notification) =>
  n.kind === 'monitor.down' ? (ERROR_LABEL[n.body] ?? n.body) : n.body

/** In-app notifications (MASTER_PLAN §34): polled while the tab is visible. */
export function Notifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [failed, setFailed] = useState(false)

  // Ids already shown or present at first load; only later arrivals become OS notifications.
  const [seen] = useState(() => ({ ids: null as Set<string> | null }))

  const load = useCallback(
    () =>
      request<{ items: Notification[]; unread: number }>('GET', '/api/notifications').then(
        (res) => {
          setFailed(!res.ok)
          if (!res.ok) return
          setItems(res.data.items)
          setUnread(res.data.unread)
          if (!desktop) return
          void desktop.invoke('set_unread', { count: res.data.unread })
          const fresh = seen.ids ? res.data.items.filter((n) => !seen.ids!.has(n.id)) : []
          seen.ids = new Set(res.data.items.map((n) => n.id))
          for (const n of fresh.filter((n) => !n.readAt).slice(0, 3)) {
            void desktop.invoke('notify', { title: n.title, body: bodyText(n) })
          }
        },
      ),
    [seen],
  )

  useEffect(() => {
    void load()
    // The desktop app keeps polling from the tray, where the document reports hidden.
    const t = setInterval(() => {
      if (desktop || document.visibilityState === 'visible') void load()
    }, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const markRead = async (id?: string) => {
    await request('POST', id ? `/api/notifications/${id}/read` : '/api/notifications/read-all')
    await load()
  }

  const label = unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) void load()
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="relative grid size-8 place-items-center rounded-full text-secondary transition-colors duration-(--dh-duration-fast) hover:bg-hover hover:text-primary data-[state=open]:bg-selected data-[state=open]:text-primary"
        >
          <Bell size={18} strokeWidth={1.75} aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 font-mono text-caption leading-none text-on-brand tabular"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          aria-label="Notificações"
          className="dh-material-elevated z-(--dh-z-popover) w-[min(380px,calc(100vw-16px))] rounded-floating p-2 outline-none origin-(--radix-popover-content-transform-origin) data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in"
        >
          <div className="flex items-center justify-between px-1.5 pt-1 pb-2">
            <h2 className="text-footnote font-semibold">Notificações</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markRead()}
                className="rounded-control px-2 py-1 text-footnote text-secondary hover:bg-hover hover:text-primary"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          {failed && items.length === 0 ? (
            <p className="px-1.5 pb-2 text-body text-secondary">
              Não foi possível carregar as notificações.
            </p>
          ) : items.length === 0 ? (
            <p className="px-1.5 pb-2 text-body text-secondary">
              Nenhuma notificação. Avisos de monitores e integrações aparecem aqui.
            </p>
          ) : (
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
              {items.map((n) => {
                const meta = SEVERITY[n.severity]
                const Icon = meta.icon
                const content = (
                  <>
                    <Icon
                      size={16}
                      strokeWidth={2}
                      aria-label={meta.label}
                      className={`mt-0.5 shrink-0 ${meta.color}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-body ${n.readAt ? 'text-secondary' : 'font-medium'}`}
                      >
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="block truncate text-caption text-secondary">
                          {bodyText(n)}
                        </span>
                      )}
                      <time dateTime={n.createdAt} className="block text-caption text-secondary">
                        {timeFormat.format(new Date(n.createdAt))}
                      </time>
                    </span>
                    {!n.readAt && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                    )}
                  </>
                )
                const row =
                  'flex w-full items-start gap-2.5 rounded-surface bg-hover p-2.5 text-left hover:bg-selected'
                const onSelect = () => {
                  if (!n.readAt) void markRead(n.id)
                  setOpen(false)
                }
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link to={n.href} className={row} onClick={onSelect}>
                        {content}
                        {!n.readAt && <span className="sr-only">(não lida)</span>}
                      </Link>
                    ) : (
                      <button type="button" className={row} onClick={onSelect}>
                        {content}
                        {!n.readAt && <span className="sr-only">(não lida)</span>}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
