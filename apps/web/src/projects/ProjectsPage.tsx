import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Search } from 'lucide-react'
import {
  createProject,
  errorMessage,
  listProjects,
  STATUS_META,
  STATUSES,
  type Project,
  type ProjectStatus,
} from './projects'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'

type Filter = 'active' | 'all' | ProjectStatus

/** Loads every page. shortcut: fine for a personal workspace (tens of projects); switch to
 *  server-side search and infinite scroll when workspaces are shared (Phase 9). */
async function loadAll() {
  const items: Project[] = []
  let cursor: string | undefined
  do {
    const res = await listProjects(cursor)
    if (!res.ok) return { ok: false as const, status: res.status }
    items.push(...res.data.items)
    cursor = res.data.nextCursor ?? undefined
  } while (cursor)
  return { ok: true as const, items }
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-footnote text-secondary">
      <span className={`size-2 rounded-full bg-current ${meta.color}`} aria-hidden />
      {meta.label}
    </span>
  )
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [creating, setCreating] = useState(false)
  const id = useId()

  useEffect(() => {
    let live = true
    void loadAll().then((res) => {
      if (!live) return
      if (res.ok) setProjects(res.items)
      else setLoadError(errorMessage(res.status))
    })
    return () => {
      live = false
    }
  }, [attempt])

  const q = query.trim().toLocaleLowerCase('pt-BR')
  const visible = (projects ?? []).filter(
    (p) =>
      (filter === 'all' || (filter === 'active' ? p.status !== 'archived' : p.status === filter)) &&
      (q === '' ||
        p.name.toLocaleLowerCase('pt-BR').includes(q) ||
        p.description.toLocaleLowerCase('pt-BR').includes(q)),
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
            Projetos
          </h1>
          <p className="mt-1 text-callout text-secondary">
            Projetos do workspace, com status e descrição.
          </p>
        </div>
        {!creating && (
          <button type="button" className={primaryButton} onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> Novo projeto
          </button>
        )}
      </header>

      {creating && (
        <CreateForm
          onCancel={() => setCreating(false)}
          onCreated={(p) => {
            setProjects((list) => [p, ...(list ?? [])])
            setCreating(false)
          }}
        />
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-secondary"
            aria-hidden
          />
          <label htmlFor={`${id}-q`} className="sr-only">
            Buscar projetos
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou descrição"
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <label htmlFor={`${id}-status`} className="sr-only">
          Filtrar por status
        </label>
        <select
          id={`${id}-status`}
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className={inputClass}
        >
          <option value="active">Ativos</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
          <option value="all">Todos</option>
        </select>
      </div>

      <section
        aria-label="Lista de projetos"
        className="overflow-hidden rounded-surface border border-subtle bg-surface"
      >
        {loadError ? (
          <div className="p-6">
            <p role="alert" className="text-error">
              {loadError}
            </p>
            <button
              type="button"
              className={`${secondaryButton} mt-3`}
              onClick={() => {
                setLoadError(null)
                setAttempt((n) => n + 1)
              }}
            >
              Tentar de novo
            </button>
          </div>
        ) : projects === null ? (
          <p className="p-6 text-secondary">Carregando projetos…</p>
        ) : projects.length === 0 ? (
          <div className="p-6">
            <h2 className="text-headline">Nenhum projeto ainda</h2>
            <p className="mt-1 text-secondary">
              Crie o primeiro projeto. Repositórios e monitores são vinculados a ele depois.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="p-6 text-secondary">Nenhum projeto corresponde à busca ou ao filtro.</p>
        ) : (
          <table className="w-full text-left text-body">
            <thead className="border-b border-subtle text-footnote text-secondary">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Nome
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                  Atualizado
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-b border-subtle last:border-0 hover:bg-hover">
                  <td className="max-w-0 px-4 py-3">
                    <Link
                      to={`/projects/${p.id}`}
                      className="block truncate font-medium text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.description && (
                      <p className="truncate text-footnote text-secondary">{p.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-footnote text-secondary md:table-cell">
                    {dateFormat.format(new Date(p.updatedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function CreateForm(props: { onCancel: () => void; onCreated: (p: Project) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const id = useId()

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    const res = await createProject({
      name: String(form.get('name')),
      description: String(form.get('description') ?? ''),
    })
    setBusy(false)
    if (!res.ok) return setError(errorMessage(res.status))
    props.onCreated(res.data)
    void navigate(`/projects/${res.data.id}`)
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      aria-label="Novo projeto"
      className="mb-6 space-y-3 rounded-surface border border-subtle bg-surface p-4"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-1">
          <label htmlFor={`${id}-name`} className="text-footnote font-medium">
            Nome
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={80}
            autoFocus
            className={`${inputClass} w-full`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-description`} className="text-footnote font-medium">
            Descrição <span className="font-normal text-secondary">(opcional)</span>
          </label>
          <input
            id={`${id}-description`}
            name="description"
            maxLength={2000}
            className={`${inputClass} w-full`}
          />
        </div>
      </div>
      <p role="alert" className="text-footnote text-error empty:hidden">
        {error}
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Criando…' : 'Criar projeto'}
        </button>
        <button type="button" onClick={props.onCancel} className={secondaryButton}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
