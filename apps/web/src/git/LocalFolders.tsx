import { useEffect, useState } from 'react'
import { FolderGit2, FolderPlus, RefreshCw } from 'lucide-react'
import { secondaryButton } from '../components/formStyles'
import { formatDate, rowButton } from '../components/page-utils'
import { desktop, type Folder, type GitStatus, type OpenTarget, type Tool } from '../desktop/bridge'

const TARGETS: { id: OpenTarget; label: string; tool?: string }[] = [
  { id: 'explorer', label: 'Explorer' },
  { id: 'vscode', label: 'VS Code', tool: 'vscode' },
  { id: 'cursor', label: 'Cursor', tool: 'cursor' },
  { id: 'terminal', label: 'Terminal' },
]

function summary(s: GitStatus) {
  const parts = []
  if (s.changed) parts.push(`${s.changed} alterado${s.changed > 1 ? 's' : ''}`)
  if (s.untracked) parts.push(`${s.untracked} novo${s.untracked > 1 ? 's' : ''}`)
  if (s.conflicts) parts.push(`${s.conflicts} em conflito`)
  if (s.ahead) parts.push(`${s.ahead} à frente`)
  if (s.behind) parts.push(`${s.behind} atrás`)
  return parts.length ? parts.join(' · ') : 'Limpo'
}

function FolderRow(props: { folder: Folder; tools: Tool[]; onRemove: () => void }) {
  const { folder } = props
  const [status, setStatus] = useState<GitStatus | null | string>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    desktop!.invoke('git_status', { path: folder.path }).then(
      (s) => live && setStatus(s),
      (e: unknown) => live && setStatus(String(e)),
    )
    return () => {
      live = false
    }
  }, [folder.path, attempt])

  const installed = (id?: string) => !id || props.tools.some((t) => t.id === id && t.version)
  const open = (target: OpenTarget) =>
    desktop!.invoke('open_in', { path: folder.path, target }).then(
      () => setError(null),
      (e: unknown) => setError(String(e)),
    )

  return (
    <li className="border-t border-subtle px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-body font-medium">{folder.name}</span>
          <span className="block truncate font-mono text-caption text-secondary">
            {folder.path}
          </span>
        </span>
        <span className="font-mono text-footnote text-secondary">
          {status === null
            ? 'Lendo…'
            : typeof status === 'string'
              ? status
              : !status.isRepo
                ? 'Não é um repositório Git'
                : `${status.branch ?? 'HEAD destacado'} · ${summary(status)}`}
        </span>
      </div>
      {status && typeof status !== 'string' && status.lastCommit && (
        <p className="mt-1 truncate text-footnote text-secondary">
          <span className="font-mono">{status.lastCommit.sha}</span> {status.lastCommit.subject} ·{' '}
          {formatDate(status.lastCommit.date)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {TARGETS.filter((t) => installed(t.tool)).map((t) => (
          <button
            key={t.id}
            type="button"
            className={rowButton}
            onClick={() => void open(t.id)}
            aria-label={`Abrir ${folder.name} no ${t.label}`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className={rowButton}
          onClick={() => setAttempt((n) => n + 1)}
          aria-label={`Atualizar status de ${folder.name}`}
        >
          <RefreshCw size={14} aria-hidden /> Atualizar
        </button>
        <button
          type="button"
          className={rowButton}
          onClick={props.onRemove}
          aria-label={`Remover autorização de ${folder.name}`}
        >
          Remover
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-footnote text-error">
          {error}
        </p>
      )}
    </li>
  )
}

/** Local repositories (Phase 3). Only in the desktop app: the browser has no folder access. */
export function LocalFolders() {
  const [folders, setFolders] = useState<Folder[] | null>(null)
  const [tools, setTools] = useState<Tool[]>([])

  useEffect(() => {
    if (!desktop) return
    void desktop.invoke('folders_list', {}).then(setFolders)
    void desktop.invoke('tools', {}).then(setTools)
  }, [])

  const heading = (
    <h2 id="local-title" className="flex items-center gap-2 text-headline">
      <FolderGit2 size={18} aria-hidden /> Pastas locais
    </h2>
  )

  if (!desktop) {
    return (
      <section
        aria-labelledby="local-title"
        className="mt-6 rounded-surface border border-subtle bg-surface p-5"
      >
        {heading}
        <p className="mt-1 text-secondary">
          Status do Git local e abrir no editor ficam disponíveis no app desktop do DevHub.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="local-title"
      className="mt-6 overflow-hidden rounded-surface border border-subtle bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
        <div>
          {heading}
          <p className="mt-0.5 text-footnote text-secondary">
            O DevHub só lê as pastas que você autorizar aqui. Nada é enviado ao servidor.
          </p>
        </div>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => void desktop!.invoke('folders_add', {}).then(setFolders)}
        >
          <FolderPlus size={16} aria-hidden /> Autorizar pasta
        </button>
      </div>
      {tools.length > 0 && (
        <p className="px-5 pb-3 font-mono text-caption text-secondary">
          {tools.map((t) => `${t.label}: ${t.version ?? 'não encontrado'}`).join(' · ')}
        </p>
      )}
      {folders === null ? (
        <p className="px-5 pb-4 text-secondary">Carregando…</p>
      ) : folders.length === 0 ? (
        <p className="px-5 pb-4 text-secondary">Nenhuma pasta autorizada.</p>
      ) : (
        <ul className="border-t border-subtle">
          {folders.map((f) => (
            <FolderRow
              key={f.path}
              folder={f}
              tools={tools}
              onRemove={() =>
                void desktop!.invoke('folders_remove', { path: f.path }).then(setFolders)
              }
            />
          ))}
        </ul>
      )}
    </section>
  )
}
