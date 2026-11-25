import type { ReactNode } from 'react'
import { PanelLeft, PanelRight } from 'lucide-react'

// P2 scope: sidebar toggle, title, inspector toggle. Breadcrumbs, search and actions land in P3.

export function ToolbarButton(props: {
  label: string
  pressed?: boolean
  expanded?: boolean
  controls?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed}
      aria-expanded={props.expanded}
      aria-controls={props.controls}
      onClick={props.onClick}
      className="grid size-8 place-items-center rounded-control text-secondary transition-colors duration-(--dh-duration-fast) hover:bg-hover hover:text-primary aria-pressed:text-primary"
    >
      {props.children}
    </button>
  )
}

export function Toolbar(props: {
  title: string
  sidebarVisible: boolean
  onToggleSidebar: () => void
  inspector?: { open: boolean; onToggle: () => void }
}) {
  return (
    <header className="flex h-13 shrink-0 items-center gap-2 border-b border-subtle px-3">
      <ToolbarButton
        label={props.sidebarVisible ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
        expanded={props.sidebarVisible}
        controls="sidebar"
        onClick={props.onToggleSidebar}
      >
        <PanelLeft size={18} strokeWidth={1.75} aria-hidden />
      </ToolbarButton>
      <div className="min-w-0 flex-1 truncate text-headline" aria-hidden>
        {props.title}
      </div>
      {props.inspector && (
        <ToolbarButton
          label={props.inspector.open ? 'Ocultar inspetor' : 'Mostrar inspetor'}
          expanded={props.inspector.open}
          controls="inspector"
          onClick={props.inspector.onToggle}
        >
          <PanelRight size={18} strokeWidth={1.75} aria-hidden />
        </ToolbarButton>
      )}
    </header>
  )
}
