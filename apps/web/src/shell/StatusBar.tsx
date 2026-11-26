export function StatusBar() {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-subtle px-3 text-caption text-secondary">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
        <span className="truncate">
          Todos os módulos com dados reais · métricas de servidor aguardam o Local Agent
        </span>
      </span>
      <span className="truncate">Local Agent: disponível no app Desktop (Fase 3)</span>
    </footer>
  )
}
