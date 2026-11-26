import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink, Lock, Unlink } from 'lucide-react'
import { inputClass, secondaryButton } from '../components/formStyles'
import {
  linkRepository,
  listRepositories,
  projectRepositories,
  repoError,
  unlinkRepository,
  type Repository,
} from '../git/repositories'

/** Repositories linked to one project, and a picker over the workspace's imported ones. */
export function ProjectRepositories({ projectId }: { projectId: string }) {
  const [linked, setLinked] = useState<Repository[] | null>(null)
  const [all, setAll] = useState<Repository[]>([])
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [choice, setChoice] = useState('')
  const id = useId()

  useEffect(() => {
    let live = true
    void Promise.all([projectRepositories(projectId), listRepositories()]).then(([a, b]) => {
      if (!live) return
      if (a.ok) setLinked(a.data)
      else setError(repoError(a.status))
      if (b.ok) setAll(b.data)
    })
    return () => {
      live = false
    }
  }, [projectId, version])

  async function act(run: () => Promise<{ ok: boolean; status: number }>) {
    setError(null)
    const res = await run()
    if (!res.ok) setError(repoError(res.status))
    setChoice('')
    setVersion((n) => n + 1)
  }

  const linkedIds = new Set((linked ?? []).map((r) => r.id))
  const options = all.filter((r) => !linkedIds.has(r.id))

  return (
    <section aria-labelledby="project-repos" className="mt-8">
      <h2 id="project-repos" className="text-headline">
        Repositórios
      </h2>
      <p role="alert" className="mt-1 text-footnote text-error empty:hidden">
        {error}
      </p>
      {linked === null ? (
        <p className="mt-2 text-secondary">Carregando…</p>
      ) : linked.length === 0 ? (
        <p className="mt-1 text-secondary">Nenhum repositório vinculado.</p>
      ) : (
        <ul className="mt-2 divide-y divide-subtle rounded-surface border border-subtle bg-surface">
          {linked.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <a
                href={r.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 font-mono text-footnote hover:underline"
              >
                {r.private && <Lock size={12} aria-label="privado" className="shrink-0" />}
                <span className="truncate">{r.fullName}</span>
                <ExternalLink size={12} aria-hidden className="shrink-0 text-secondary" />
              </a>
              <button
                type="button"
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-control px-2 text-footnote text-secondary hover:bg-hover hover:text-primary"
                onClick={() => void act(() => unlinkRepository(projectId, r.id))}
              >
                <Unlink size={14} aria-hidden /> Desvincular
              </button>
            </li>
          ))}
        </ul>
      )}
      {options.length > 0 ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (choice) void act(() => linkRepository(projectId, choice))
          }}
        >
          <label htmlFor={`${id}-repo`} className="sr-only">
            Repositório para vincular
          </label>
          <select
            id={`${id}-repo`}
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className={`${inputClass} min-w-56`}
          >
            <option value="">Escolha um repositório importado</option>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!choice} className={secondaryButton}>
            Vincular
          </button>
        </form>
      ) : (
        linked !== null && (
          <p className="mt-2 text-footnote text-secondary">
            Para vincular, importe repositórios no{' '}
            <Link to="/git" className="text-accent underline underline-offset-2">
              Git Center
            </Link>
            .
          </p>
        )
      )}
    </section>
  )
}
