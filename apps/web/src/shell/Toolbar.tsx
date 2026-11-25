import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { DropdownMenu } from 'radix-ui'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Link2,
  PanelLeft,
  PanelRight,
  Search,
} from 'lucide-react'
import { isApple, shortcut } from '../platform'

/** Below this toolbar width, back/forward move into the overflow menu and breadcrumbs
 *  collapse to the current page. Measured on the toolbar, not the window. */
const NARROW = 560

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(Infinity)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Navigation API where available (Chromium, incl. WebView2); otherwise React Router's
 *  history index for back and an always-enabled forward. */
function useHistoryAvailability() {
  useLocation() // re-render on navigation
  if ('navigation' in window && window.navigation) {
    return { back: window.navigation.canGoBack, forward: window.navigation.canGoForward }
  }
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  return { back: idx > 0, forward: true }
}

function IconButton(props: {
  label: string
  expanded?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-expanded={props.expanded}
      disabled={props.disabled}
      onClick={props.onClick}
      className="grid size-8 place-items-center rounded-full text-secondary transition-colors duration-(--dh-duration-fast) hover:bg-hover hover:text-primary disabled:pointer-events-none disabled:text-tertiary"
    >
      {props.children}
    </button>
  )
}

/** Related controls share one glass capsule (HIG: group toolbar items by function). */
function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="dh-material-regular flex shrink-0 items-center gap-0.5 rounded-full p-0.5"
    >
      {children}
    </div>
  )
}

const menuItem =
  'flex h-8 cursor-default items-center gap-2.5 rounded-control px-2.5 text-body outline-none select-none data-disabled:text-tertiary data-highlighted:bg-selected'

export interface Crumb {
  label: string
}

export function Toolbar(props: {
  crumbs: Crumb[]
  scrolled: boolean
  sidebarVisible: boolean
  onToggleSidebar: () => void
  inspector?: { open: boolean; onToggle: () => void }
  /** Shown as a check on the menu button after copy-link; announced by the shell. */
  notice: { ok: boolean } | null
  onCopyLink: () => void
  onSearch: () => void
}) {
  const [ref, width] = useWidth<HTMLElement>()
  const narrow = width < NARROW
  const navigate = useNavigate()
  const can = useHistoryAvailability()
  const notice = props.notice

  const crumbs = narrow ? props.crumbs.slice(-1) : props.crumbs
  const iconProps = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const

  return (
    <header
      ref={ref}
      className={[
        'z-(--dh-z-navigation) flex h-13 shrink-0 items-center gap-2 border-b px-3 transition-colors duration-(--dh-duration-fast)',
        // Scroll edge: the separator appears only once content scrolls under the bar.
        props.scrolled ? 'border-subtle' : 'border-transparent',
      ].join(' ')}
    >
      <Group label="Navegação">
        <IconButton
          label={props.sidebarVisible ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
          expanded={props.sidebarVisible}
          onClick={props.onToggleSidebar}
        >
          <PanelLeft {...iconProps} />
        </IconButton>
        {!narrow && (
          <>
            <IconButton label="Voltar" disabled={!can.back} onClick={() => navigate(-1)}>
              <ChevronLeft {...iconProps} />
            </IconButton>
            <IconButton label="Avançar" disabled={!can.forward} onClick={() => navigate(1)}>
              <ChevronRight {...iconProps} />
            </IconButton>
          </>
        )}
      </Group>

      <nav aria-label="Trilha" className="min-w-0 flex-1 px-1">
        <ol className="flex min-w-0 items-center gap-1.5">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <li key={i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronRight size={14} className="shrink-0 text-tertiary" aria-hidden />}
                <span
                  aria-current={last ? 'page' : undefined}
                  className={
                    last ? 'truncate text-headline' : 'shrink-0 truncate text-body text-secondary'
                  }
                >
                  {c.label}
                </span>
              </li>
            )
          })}
        </ol>
      </nav>

      <Group label="Busca">
        {narrow ? (
          <IconButton label={`Buscar (${shortcut('K')})`} onClick={props.onSearch}>
            <Search {...iconProps} />
          </IconButton>
        ) : (
          <button
            type="button"
            onClick={props.onSearch}
            aria-keyshortcuts={isApple ? 'Meta+K' : 'Control+K'}
            className="flex h-8 w-52 items-center gap-2 rounded-full px-2.5 text-secondary transition-colors duration-(--dh-duration-fast) hover:bg-hover hover:text-primary"
          >
            <Search size={16} strokeWidth={1.75} aria-hidden />
            <span className="flex-1 text-left">Buscar</span>
            <kbd className="font-sans text-caption text-secondary">{shortcut('K')}</kbd>
          </button>
        )}
      </Group>

      <Group label="Ações">
        {props.inspector && (
          <IconButton
            label={props.inspector.open ? 'Ocultar inspetor' : 'Mostrar inspetor'}
            expanded={props.inspector.open}
            onClick={props.inspector.onToggle}
          >
            <PanelRight {...iconProps} />
          </IconButton>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Mais ações"
              title="Mais ações"
              className="grid size-8 place-items-center rounded-full text-secondary transition-colors duration-(--dh-duration-fast) hover:bg-hover hover:text-primary data-[state=open]:bg-selected data-[state=open]:text-primary"
            >
              {notice?.ok ? (
                <Check {...iconProps} className="text-success" />
              ) : (
                <Ellipsis {...iconProps} />
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="dh-material-elevated z-(--dh-z-popover) min-w-52 rounded-popover p-1.5"
            >
              {narrow && (
                <>
                  <DropdownMenu.Item
                    className={menuItem}
                    disabled={!can.back}
                    onSelect={() => navigate(-1)}
                  >
                    <ChevronLeft size={16} aria-hidden /> Voltar
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className={menuItem}
                    disabled={!can.forward}
                    onSelect={() => navigate(1)}
                  >
                    <ChevronRight size={16} aria-hidden /> Avançar
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="mx-1 my-1 h-px bg-subtle" />
                </>
              )}
              <DropdownMenu.Item className={menuItem} onSelect={props.onCopyLink}>
                <Link2 size={16} aria-hidden /> Copiar link da página
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </Group>
    </header>
  )
}
