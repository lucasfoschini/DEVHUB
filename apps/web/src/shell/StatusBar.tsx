export function StatusBar() {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-subtle px-3 text-caption text-secondary">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="size-1.5 shrink-0 rounded-full bg-pending" aria-hidden />
        <span className="truncate">Protótipo · sem dados reais</span>
      </span>
      <span className="truncate">Local Agent: disponível no app Desktop (Fase 3)</span>
    </footer>
  )
}
