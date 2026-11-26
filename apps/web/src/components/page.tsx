import type { ReactNode } from 'react'
import { secondaryButton } from './formStyles'

/** Module page frame: title, one-line purpose, optional primary action. Rises in on mount. */
export function PageShell(props: {
  title: string
  subtitle: string
  action?: ReactNode
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`mx-auto w-full px-5 py-8 md:px-8 md:py-10 ${props.wide ? 'max-w-6xl' : 'max-w-5xl'}`}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
            {props.title}
          </h1>
          <p className="mt-1 text-callout text-secondary">{props.subtitle}</p>
        </div>
        {props.action}
      </header>
      {props.children}
    </div>
  )
}

/** Loading, error and empty states shared by module pages. */
export function Loadable<T>(props: {
  state: { data: T | null; error: number | null; reload: () => void }
  what: string
  children: (data: T) => ReactNode
}) {
  const { data, error, reload } = props.state
  if (error !== null) {
    return (
      <div className="rounded-surface border border-subtle bg-surface p-6">
        <p role="alert" className="text-error">
          {error === 503
            ? `${props.what}: recurso não configurado no servidor.`
            : `Não foi possível carregar ${props.what}.`}
        </p>
        <button type="button" className={`${secondaryButton} mt-3`} onClick={reload}>
          Tentar de novo
        </button>
      </div>
    )
  }
  if (data === null) return <p className="text-secondary">Carregando {props.what}…</p>
  return <>{props.children(data)}</>
}

export function Field(props: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={props.id} className="text-footnote font-medium">
        {props.label}
      </label>
      {props.children}
      {props.hint && <span className="text-caption text-secondary">{props.hint}</span>}
    </div>
  )
}

/** A surface for data (solid, never glass). */
export function Panel(props: { label?: string; className?: string; children: ReactNode }) {
  return (
    <section
      aria-label={props.label}
      className={`overflow-hidden rounded-surface border border-subtle bg-surface ${props.className ?? ''}`}
    >
      {props.children}
    </section>
  )
}
