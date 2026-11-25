import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Outlet, useLocation, useMatches } from 'react-router'
import { Tooltip } from 'radix-ui'
import type { ModuleDef } from '../nav'
import { oneOf, usePersistentState } from '../usePersistentState'
import { useMaterialPref, useThemePref } from '../appearance'
import { Sidebar } from './Sidebar'
import { SIDEBAR, type DockedMode } from './sidebarSize'
import { Sheet } from './Sheet'
import { StatusBar } from './StatusBar'
import { Toolbar } from './Toolbar'
import { useTier } from './useTier'

export interface RouteHandle {
  module?: ModuleDef
}

type DockPref = DockedMode | 'hidden'

function InspectorBody({ inspector }: { inspector: NonNullable<ModuleDef['inspector']> }) {
  return (
    <div className="p-4">
      <h2 className="text-headline">{inspector.title}</h2>
      <p className="mt-2 text-secondary">{inspector.empty}</p>
    </div>
  )
}

export function AppShell() {
  useThemePref()
  useMaterialPref()
  const tier = useTier()
  const { pathname } = useLocation()
  const module = (useMatches().at(-1)?.handle as RouteHandle | undefined)?.module

  const [dock, setDock] = usePersistentState<DockPref>(
    'dh.sidebar',
    'expanded',
    oneOf<DockPref>('expanded', 'compact', 'hidden'),
  )
  const [width, setWidth] = usePersistentState<number>(
    'dh.sidebarWidth',
    SIDEBAR.default,
    (w) => w >= SIDEBAR.min && w <= SIDEBAR.max,
  )
  const [inspectorPref, setInspectorPref] = usePersistentState<'open' | 'closed'>(
    'dh.inspector',
    'open',
    oneOf<'open' | 'closed'>('open', 'closed'),
  )
  const [overlay, setOverlay] = useState(false)
  const [inspectorSheet, setInspectorSheet] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // expanded/large: docked sidebar, user picks expanded | compact | hidden.
  // medium: compact rail + overlay. compact: overlay only.
  const canDock = tier === 'expanded' || tier === 'large'
  const docked: DockedMode | null = canDock
    ? dock === 'hidden'
      ? null
      : dock
    : tier === 'medium'
      ? 'compact'
      : null
  const overlayOpen = overlay && !canDock
  const sidebarVisible = canDock ? docked !== null : overlayOpen

  const inspector = module?.inspector
  const inspectorDocked = tier === 'large'
  const inspectorOpen = inspectorDocked ? inspectorPref === 'open' : inspectorSheet

  const toggleSidebar = () =>
    canDock ? setDock(dock === 'hidden' ? 'expanded' : 'hidden') : setOverlay(!overlayOpen)
  const toggleInspector = () =>
    inspectorDocked
      ? setInspectorPref(inspectorPref === 'open' ? 'closed' : 'open')
      : setInspectorSheet(!inspectorSheet)

  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault()
      toggleSidebar()
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  useEffect(() => {
    document.title = module ? `${module.label} · DevHub` : 'DevHub'
  }, [module])

  // On navigation: reset scroll and move focus to the new page title (not on first load).
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.querySelector<HTMLElement>('[data-page-title]')?.focus()
  }, [pathname])

  return (
    <Tooltip.Provider delayDuration={300}>
      <a
        href="#main"
        className="sr-only z-(--dh-z-toast) rounded-control bg-action px-3 py-2 text-action-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <div className="flex h-dvh overflow-hidden bg-canvas">
        {docked && (
          <aside
            aria-label="Barra lateral"
            style={{ width: docked === 'compact' ? SIDEBAR.rail : width }}
            className={[
              'dh-material-regular z-(--dh-z-navigation) shrink-0 border-0 border-r',
              resizing ? '' : 'transition-[width] duration-(--dh-duration-normal) ease-emphasized',
            ].join(' ')}
          >
            <Sidebar
              mode={docked}
              width={width}
              onResize={
                canDock
                  ? (mode, w) => {
                      setDock(mode)
                      setWidth(w)
                    }
                  : undefined
              }
              onResizeStart={() => setResizing(true)}
              onResizeEnd={() => setResizing(false)}
            />
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Toolbar
            crumbs={[{ label: 'Pessoal' }, { label: module?.label ?? 'Página não encontrada' }]}
            scrolled={scrolled}
            sidebarVisible={sidebarVisible}
            onToggleSidebar={toggleSidebar}
            inspector={inspector ? { open: inspectorOpen, onToggle: toggleInspector } : undefined}
          />
          <div className="flex min-h-0 flex-1">
            <main
              id="main"
              ref={mainRef}
              tabIndex={-1}
              onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
              className="min-w-0 flex-1 overflow-y-auto outline-none"
            >
              <Outlet />
            </main>
            {inspector && inspectorDocked && inspectorOpen && (
              <aside
                aria-label={inspector.title}
                className="w-75 shrink-0 overflow-y-auto border-l border-subtle bg-surface"
              >
                <InspectorBody inspector={inspector} />
              </aside>
            )}
          </div>
          <StatusBar />
        </div>
      </div>

      <Sheet side="left" open={overlayOpen} onOpenChange={setOverlay} title="Navegação">
        <Sidebar
          mode="expanded"
          width={SIDEBAR.max}
          comfortable
          onNavigate={() => setOverlay(false)}
        />
      </Sheet>
      {inspector && (
        <Sheet
          side="right"
          open={!inspectorDocked && inspectorSheet}
          onOpenChange={setInspectorSheet}
          title={inspector.title}
        >
          <InspectorBody inspector={inspector} />
        </Sheet>
      )}
    </Tooltip.Provider>
  )
}
