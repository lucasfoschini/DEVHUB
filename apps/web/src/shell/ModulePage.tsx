import { Construction } from 'lucide-react'
import type { ModuleDef } from '../nav'

/** Empty state until each module is built (after P8). States what exists, invents nothing. */
export function ModulePage({ module: m }: { module: ModuleDef }) {
  const Icon = m.icon
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-8">
        <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
          {m.label}
        </h1>
        <p className="mt-1 max-w-[60ch] text-callout text-secondary">{m.purpose}</p>
      </header>
      <section className="flex flex-col items-start gap-4 rounded-surface border border-subtle bg-surface p-6 md:flex-row">
        <span className="grid size-10 shrink-0 place-items-center rounded-control bg-raised text-secondary">
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-headline">Este módulo ainda não foi construído</h2>
          <p className="mt-1 max-w-[60ch] text-secondary">
            A navegação já funciona. A tela deste módulo entra no roadmap depois da fundação do
            Application Shell.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-subtle px-2.5 py-0.5 text-footnote text-secondary">
            <Construction size={14} strokeWidth={1.75} aria-hidden />
            Planejado para {m.phase}
          </p>
        </div>
      </section>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8">
      <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
        Página não encontrada
      </h1>
      <p className="mt-1 text-secondary">Use a barra lateral para escolher um módulo.</p>
    </div>
  )
}
