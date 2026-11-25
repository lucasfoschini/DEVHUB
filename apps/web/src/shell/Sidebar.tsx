import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { NavLink } from 'react-router'
import { Tooltip } from 'radix-ui'
import { Terminal } from 'lucide-react'
import { groups, modules, type ModuleDef } from '../nav'
import { SIDEBAR, type DockedMode } from './sidebarSize'

interface Props {
  mode: DockedMode
  width: number
  /** Taller rows for touch-first overlays. */
  comfortable?: boolean
  onNavigate?: () => void
  /** Docked only: drag or arrow keys resize; dragging below `snap` collapses to the rail. */
  onResize?: (mode: DockedMode, width: number) => void
  onResizeStart?: () => void
  onResizeEnd?: () => void
}

function Brand({ compact }: { compact: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? 'justify-center' : 'px-2'}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-control bg-brand text-on-brand shadow-navigation">
        <Terminal size={18} strokeWidth={2.25} aria-hidden />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block text-headline leading-5">DevHub</span>
          <span className="block truncate text-caption text-secondary">Workspace pessoal</span>
        </span>
      )}
    </div>
  )
}

function Item({
  module: m,
  compact,
  comfortable,
  onNavigate,
}: {
  module: ModuleDef
  compact: boolean
  comfortable: boolean
  onNavigate?: () => void
}) {
  const Icon = m.icon
  const link = (
    <NavLink
      to={m.path}
      end={m.path === '/'}
      onClick={onNavigate}
      data-nav-item
      aria-label={compact ? m.label : undefined}
      className={({ isActive }) =>
        [
          'group flex items-center gap-2.5 rounded-control text-secondary outline-offset-[-2px]',
          'transition-colors duration-(--dh-duration-fast) ease-standard hover:bg-hover hover:text-primary',
          comfortable ? 'h-11 px-3 text-callout' : 'h-8 px-2.5',
          compact ? 'justify-center px-0' : '',
          isActive ? 'bg-selected font-medium text-primary' : '',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={comfortable ? 18 : 16}
            strokeWidth={1.75}
            aria-hidden
            className={isActive ? 'text-accent' : ''}
          />
          {!compact && <span className="truncate">{m.label}</span>}
        </>
      )}
    </NavLink>
  )
  if (!compact) return link
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="z-(--dh-z-popover) rounded-control border border-subtle bg-raised px-2 py-1 text-footnote shadow-overlay"
        >
          {m.label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

/** Arrow keys move between nav links; Home/End jump to the ends. */
function onNavKeyDown(e: KeyboardEvent<HTMLElement>) {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(e.key)) return
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-nav-item]')]
  const i = items.indexOf(document.activeElement as HTMLElement)
  if (i === -1) return
  e.preventDefault()
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? items.length - 1
        : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
}

function ResizeHandle({
  mode,
  width,
  onResize,
  onResizeStart,
  onResizeEnd,
}: Required<Pick<Props, 'onResize'>> &
  Pick<Props, 'mode' | 'width' | 'onResizeStart' | 'onResizeEnd'>) {
  const drag = useRef<{ x: number; w: number } | null>(null)
  const current = mode === 'compact' ? SIDEBAR.rail : width

  const apply = (w: number) => {
    if (w < SIDEBAR.snap) onResize('compact', width)
    else onResize('expanded', Math.min(SIDEBAR.max, Math.max(SIDEBAR.min, w)))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, w: current }
    onResizeStart?.()
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) apply(drag.current.w + e.clientX - drag.current.x)
  }
  const onPointerUp = () => {
    drag.current = null
    onResizeEnd?.()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16
    if (e.key === 'ArrowLeft') apply(current - step)
    else if (e.key === 'ArrowRight') apply(mode === 'compact' ? width : current + step)
    else if (e.key === 'Home') onResize('compact', width)
    else if (e.key === 'End') onResize('expanded', SIDEBAR.max)
    else return
    e.preventDefault()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar barra lateral"
      aria-valuemin={SIDEBAR.rail}
      aria-valuemax={SIDEBAR.max}
      aria-valuenow={current}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onResize('expanded', SIDEBAR.default)}
      className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-offset-[-2px] after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-transparent hover:after:bg-control focus-visible:after:bg-focus"
    />
  )
}

export function Sidebar(props: Props) {
  const { mode, comfortable = false, onNavigate, onResize } = props
  const compact = mode === 'compact'
  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className={`pt-4 pb-3 ${compact ? 'px-2' : 'px-3'}`}>
        <Brand compact={compact} />
      </div>
      <nav
        aria-label="Módulos"
        onKeyDown={onNavKeyDown}
        className={`min-h-0 flex-1 overflow-y-auto pb-4 ${compact ? 'px-2' : 'px-3'}`}
      >
        {groups.map((g) => (
          <section key={g.id} aria-labelledby={`nav-${g.id}`} className="mt-3 first:mt-1">
            <h2
              id={`nav-${g.id}`}
              className={
                compact ? 'sr-only' : 'px-2.5 pb-1 text-caption font-medium text-secondary'
              }
            >
              {g.label}
            </h2>
            {compact && g.id !== groups[0]?.id && (
              <hr className="mx-2 mb-2 border-subtle" aria-hidden />
            )}
            <ul className="space-y-0.5">
              {modules
                .filter((m) => m.group === g.id)
                .map((m) => (
                  <li key={m.path}>
                    <Item
                      module={m}
                      compact={compact}
                      comfortable={comfortable}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </nav>
      {onResize && (
        <ResizeHandle
          mode={mode}
          width={props.width}
          onResize={onResize}
          onResizeStart={props.onResizeStart}
          onResizeEnd={props.onResizeEnd}
        />
      )}
    </div>
  )
}
