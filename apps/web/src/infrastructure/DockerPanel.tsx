import { useEffect, useState } from 'react'
import { Container as ContainerIcon, RefreshCw } from 'lucide-react'
import { rowButton } from '../components/page-utils'
import { desktop, type Container } from '../desktop/bridge'

const STATE_TONE: Record<string, string> = {
  running: 'text-success',
  restarting: 'text-info',
  paused: 'text-neutral',
  exited: 'text-neutral',
  dead: 'text-error',
}

/** Local Docker containers (Phase 4), read only. Only the desktop app can reach the daemon. */
export function DockerPanel() {
  const [containers, setContainers] = useState<Container[] | string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!desktop) return
    let live = true
    desktop.invoke('docker_containers', {}).then(
      (c) => live && setContainers(c),
      (e: unknown) => live && setContainers(String(e)),
    )
    return () => {
      live = false
    }
  }, [attempt])

  const heading = (
    <h2 id="docker-title" className="flex items-center gap-2 text-headline">
      <ContainerIcon size={18} aria-hidden /> Docker local
    </h2>
  )

  if (!desktop) {
    return (
      <section
        aria-labelledby="docker-title"
        className="mt-6 rounded-surface border border-subtle bg-surface p-5"
      >
        {heading}
        <p className="mt-1 text-secondary">
          Os containers desta máquina aparecem no app desktop do DevHub.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="docker-title"
      className="mt-6 overflow-hidden rounded-surface border border-subtle bg-surface"
    >
      <div className="flex items-center justify-between gap-3 p-5 pb-3">
        {heading}
        <button type="button" className={rowButton} onClick={() => setAttempt((n) => n + 1)}>
          <RefreshCw size={14} aria-hidden /> Atualizar
        </button>
      </div>
      {containers === null ? (
        <p className="px-5 pb-4 text-footnote text-secondary">Lendo…</p>
      ) : typeof containers === 'string' ? (
        <p role="alert" className="px-5 pb-4 text-footnote text-error">
          {containers}
        </p>
      ) : containers.length === 0 ? (
        <p className="px-5 pb-4 text-footnote text-secondary">Nenhum container.</p>
      ) : (
        <ul>
          {containers.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-t border-subtle px-5 py-2">
              <span aria-hidden className={`text-caption ${STATE_TONE[c.state] ?? 'text-neutral'}`}>
                ●
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body">{c.name}</span>
                <span className="block truncate font-mono text-caption text-secondary">
                  {[c.image, c.ports].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="shrink-0 text-footnote text-secondary">{c.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
