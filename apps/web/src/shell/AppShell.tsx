import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router'
import { Tooltip } from 'radix-ui'
import {
  FlaskConical,
  Layers,
  Link2,
  LogOut,
  Monitor,
  Moon,
  PanelLeft,
  PanelRight,
  SlidersHorizontal,
  Sun,
} from 'lucide-react'
import { modules, type ModuleDef } from '../nav'
import { shortcut } from '../platform'
import { oneOf, usePersistentState } from '../usePersistentState'
import { useMaterialPref, useThemePref, type MaterialPref, type ThemePref } from '../appearance'
import { Sidebar } from './Sidebar'
import { SIDEBAR, type DockedMode } from './sidebarSize'
import { Sheet } from './Sheet'
import { Spotlight, type SpotlightCommand } from './Spotlight'
import { ControlCenter } from './ControlCenter'
import { ActivityShelf } from './ActivityShelf'
import { useActivities } from '../activity/store'
import { simulateDeploy, simulateFailedBuild, simulateIndexing } from '../mocks/activitySimulator'
import { StatusBar } from './StatusBar'
import { Toolbar } from './Toolbar'
import { useTier } from './useTier'
import { useSession } from '../session'

export interface RouteHandle {
  module?: ModuleDef
}

type DockPref = DockedMode | 'hidden'

const themeOptions: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Tema: seguir o sistema', icon: Monitor },
  { value: 'dark', label: 'Tema: escuro', icon: Moon },
  { value: 'light', label: 'Tema: claro', icon: Sun },
]

const materialOptions: { value: MaterialPref; label: string }[] = [
  { value: 'system', label: 'Material: seguir o sistema' },
  { value: 'clear', label: 'Material: translúcido' },
  { value: 'balanced', label: 'Material: equilibrado' },
  { value: 'tinted', label: 'Material: tonalizado' },
  { value: 'opaque', label: 'Material: opaco (reduzir transparência)' },
]

function InspectorBody({ inspector }: { inspector: NonNullable<ModuleDef['inspector']> }) {
  return (
    <div className="p-4">
      <h2 className="text-headline">{inspector.title}</h2>
      <p className="mt-2 text-secondary">{inspector.empty}</p>
    </div>
  )
}

export function AppShell() {
  const [theme, setTheme] = useThemePref()
  const [material, setMaterial] = useMaterialPref()
  const navigate = useNavigate()
  const { signOut } = useSession()
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
  const [spotlight, setSpotlight] = useState(false)
  const [controlCenter, setControlCenter] = useState(false)
  const hasActivity = useActivities().length > 0
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 2000)
    return () => clearTimeout(t)
  }, [notice])

  const copyLink = () =>
    navigator.clipboard.writeText(window.location.href).then(
      () => setNotice({ text: 'Link copiado', ok: true }),
      () => setNotice({ text: 'Não foi possível copiar o link', ok: false }),
    )

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
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
    if (e.key === '\\') {
      e.preventDefault()
      toggleSidebar()
    } else if (e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setSpotlight((open) => !open)
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const commands: SpotlightCommand[] = [
    ...modules.map((m) => ({
      id: `nav:${m.path}`,
      label: m.label,
      group: 'Navegação' as const,
      icon: m.icon,
      keywords: [m.purpose],
      hint: m.path === pathname ? 'Atual' : undefined,
      perform: () => navigate(m.path),
    })),
    {
      id: 'action:sidebar',
      label: sidebarVisible ? 'Ocultar barra lateral' : 'Mostrar barra lateral',
      group: 'Ações',
      icon: PanelLeft,
      hint: shortcut('\\'),
      perform: toggleSidebar,
    },
    ...(inspector
      ? [
          {
            id: 'action:inspector',
            label: inspectorOpen ? 'Ocultar inspetor' : 'Mostrar inspetor',
            group: 'Ações' as const,
            icon: PanelRight,
            perform: toggleInspector,
          },
        ]
      : []),
    {
      id: 'action:control-center',
      label: 'Central de controle',
      group: 'Ações',
      icon: SlidersHorizontal,
      keywords: ['control center', 'aparência', 'tema', 'material', 'local agent'],
      perform: () => setControlCenter(true),
    },
    {
      id: 'action:sign-out',
      label: 'Sair',
      group: 'Ações',
      icon: LogOut,
      keywords: ['logout', 'sign out', 'sessão'],
      perform: () => void signOut(),
    },
    {
      id: 'action:copy-link',
      label: 'Copiar link da página',
      group: 'Ações',
      icon: Link2,
      keywords: ['url', 'compartilhar'],
      perform: () => void copyLink(),
    },
    ...[
      { id: 'demo:deploy', label: 'Simular deploy', perform: simulateDeploy },
      { id: 'demo:index', label: 'Simular indexação (sem progresso)', perform: simulateIndexing },
      { id: 'demo:failed', label: 'Simular build com falha', perform: simulateFailedBuild },
    ].map((d) => ({
      ...d,
      group: 'Demonstração' as const,
      icon: FlaskConical,
      keywords: ['demo', 'teste', 'atividade', 'activity shelf'],
    })),
    ...themeOptions.map((o) => ({
      id: `theme:${o.value}`,
      label: o.label,
      group: 'Aparência' as const,
      icon: o.icon,
      keywords: ['aparência', 'dark', 'light', 'modo'],
      checked: theme === o.value,
      perform: () => setTheme(o.value),
    })),
    ...materialOptions.map((o) => ({
      id: `material:${o.value}`,
      label: o.label,
      group: 'Aparência' as const,
      icon: Layers,
      keywords: ['vidro', 'glass', 'transparência', 'acessibilidade'],
      checked: material === o.value,
      perform: () => setMaterial(o.value),
    })),
  ]

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
            notice={notice}
            onCopyLink={() => void copyLink()}
            onSignOut={() => void signOut()}
            onSearch={() => setSpotlight(true)}
            controlCenter={
              <ControlCenter
                open={controlCenter}
                onOpenChange={setControlCenter}
                theme={theme}
                onThemeChange={setTheme}
                material={material}
                onMaterialChange={setMaterial}
              />
            }
            sidebarVisible={sidebarVisible}
            onToggleSidebar={toggleSidebar}
            inspector={inspector ? { open: inspectorOpen, onToggle: toggleInspector } : undefined}
          />
          <div className="flex min-h-0 flex-1">
            <div className="relative flex min-w-0 flex-1">
              <main
                id="main"
                ref={mainRef}
                tabIndex={-1}
                onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
                // Room for the floating shelf so it never hides the end of the content.
                className={`min-w-0 flex-1 overflow-y-auto outline-none ${hasActivity ? 'pb-16' : ''}`}
              >
                <Outlet />
              </main>
              <ActivityShelf />
            </div>
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

      <span role="status" className="sr-only">
        {notice?.text}
      </span>
      <Spotlight open={spotlight} onOpenChange={setSpotlight} commands={commands} />
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
