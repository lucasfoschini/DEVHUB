import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { Download, ExternalLink, Lock, RefreshCw, Search, Trash2 } from 'lucide-react'
import { inputClass, secondaryButton } from '../components/formStyles'
import {
  importRepository,
  listAvailable,
  listRepositories,
  removeRepository,
  repoError,
  syncRepository,
  type AvailableRepo,
  type Repository,
} from './repositories'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })
const smallButton =
  'inline-flex h-7 items-center gap-1 rounded-control px-2 text-footnote text-secondary hover:bg-hover hover:text-primary disabled:opacity-60'

/** Imported repositories plus the picker that imports more. Needs a connected GitHub. */
export function RepositoriesSection() {
  const [repos, setRepos] = useState<Repository[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [picking, setPicking] = useState(false)
  const refresh = () => setVersion((n) => n + 1)

  useEffect(() => {
    let live = true
    void listRepositories().then((res) => {
      if (!live) return
      if (res.ok) setRepos(res.data)
      else setError(repoError(res.status))
    })
    return () => {
      live = false
    }
  }, [version])

  async function act(run: () => Promise<{ ok: boolean; status: number; data: unknown }>) {
    setError(null)
    const res = await run()
    if (!res.ok) setError(repoError(res.status, (res.data as { code?: string }).code))
    refresh()
  }

  return (
    <section aria-labelledby="repos-title" className="mt-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="repos-title" className="text-headline">
          Repositórios importados
        </h2>
        <button type="button" className={secondaryButton} onClick={() => setPicking(!picking)}>
          <Download size={16} aria-hidden /> {picking ? 'Fechar importação' : 'Importar do GitHub'}
        </button>
      </div>
      <p role="alert" className="mb-2 text-footnote text-error empty:hidden">
        {error}
      </p>
      {picking && <Picker onImported={refresh} />}
      <div className="overflow-x-auto rounded-surface border border-subtle bg-surface">
        {repos === null ? (
          <p className="p-5 text-secondary">Carregando…</p>
        ) : repos.length === 0 ? (
          <p className="p-5 text-secondary">
            Nenhum repositório importado. Importe do GitHub e depois vincule a um projeto.
          </p>
        ) : (
          <table className="w-full text-left text-body">
            <thead className="border-b border-subtle text-footnote text-secondary">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Repositório
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                  Branch padrão
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Projetos
                </th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">
                  Último push
                </th>
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {repos.map((r) => (
                <tr key={r.id} className="border-b border-subtle align-top last:border-0">
                  <td className="max-w-0 px-4 py-3">
                    <a
                      href={r.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 font-mono text-footnote font-medium text-primary hover:underline"
                    >
                      {r.private && <Lock size={12} aria-label="privado" />}
                      <span className="truncate">{r.fullName}</span>
                      <ExternalLink size={12} aria-hidden className="shrink-0 text-secondary" />
                    </a>
                    {r.description && (
                      <p className="truncate text-footnote text-secondary">{r.description}</p>
                    )}
                    {r.archived && <p className="text-caption text-warning">Arquivado no GitHub</p>}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-footnote md:table-cell">
                    {r.defaultBranch}
                  </td>
                  <td className="px-4 py-3 text-footnote">
                    {r.projects && r.projects.length > 0 ? (
                      r.projects.map(({ project }) => (
                        <Link
                          key={project.id}
                          to={`/projects/${project.id}`}
                          className="mr-2 text-accent hover:underline"
                        >
                          {project.name}
                        </Link>
                      ))
                    ) : (
                      <span className="text-secondary">Nenhum</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-footnote whitespace-nowrap text-secondary lg:table-cell">
                    {r.pushedAt ? dateFormat.format(new Date(r.pushedAt)) : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      className={smallButton}
                      onClick={() => void act(() => syncRepository(r.id))}
                      aria-label={`Atualizar ${r.fullName}`}
                    >
                      <RefreshCw size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={smallButton}
                      onClick={() => void act(() => removeRepository(r.id))}
                      aria-label={`Remover ${r.fullName} do DevHub`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-caption text-secondary">
        Remover tira o repositório do DevHub e seus vínculos; nada muda no GitHub.
      </p>
    </section>
  )
}

function Picker({ onImported }: { onImported: () => void }) {
  const [items, setItems] = useState<AvailableRepo[]>([])
  const [nextPage, setNextPage] = useState<number | null>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const id = useId()

  async function loadPage(page: number) {
    setLoading(true)
    const res = await listAvailable(page)
    setLoading(false)
    if (!res.ok) return setError(repoError(res.status, res.data.code))
    setItems((prev) => [...prev, ...res.data.items])
    setNextPage(res.data.nextPage)
  }

  useEffect(() => {
    let live = true
    void listAvailable(1).then((res) => {
      if (!live) return
      if (!res.ok) return setError(repoError(res.status, res.data.code))
      setItems(res.data.items)
      setNextPage(res.data.nextPage)
    })
    return () => {
      live = false
    }
  }, [])

  async function importOne(r: AvailableRepo) {
    setBusyId(r.externalId)
    setError(null)
    const res = await importRepository(r.externalId)
    setBusyId(null)
    if (!res.ok) return setError(repoError(res.status, res.data.code))
    setItems((list) =>
      list.map((x) => (x.externalId === r.externalId ? { ...x, importedId: res.data.id } : x)),
    )
    onImported()
  }

  const q = query.trim().toLowerCase()
  const visible = items.filter((r) => r.fullName.toLowerCase().includes(q))

  return (
    <div className="mb-4 rounded-surface border border-subtle bg-surface p-4">
      <div className="relative mb-3">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-secondary"
          aria-hidden
        />
        <label htmlFor={`${id}-q`} className="sr-only">
          Filtrar repositórios do GitHub
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar os repositórios carregados"
          className={`${inputClass} w-full pl-9`}
        />
      </div>
      <p role="alert" className="mb-2 text-footnote text-error empty:hidden">
        {error}
      </p>
      <ul className="max-h-80 divide-y divide-subtle overflow-y-auto">
        {visible.map((r) => (
          <li key={r.externalId} className="flex items-center justify-between gap-3 py-2">
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-footnote">
              {r.private && <Lock size={12} aria-label="privado" className="shrink-0" />}
              <span className="truncate">{r.fullName}</span>
            </span>
            {r.importedId ? (
              <span className="shrink-0 text-footnote text-success">Importado</span>
            ) : (
              <button
                type="button"
                disabled={busyId === r.externalId}
                className={`${smallButton} shrink-0`}
                onClick={() => void importOne(r)}
                aria-label={`Importar ${r.fullName}`}
              >
                <Download size={14} aria-hidden /> Importar
              </button>
            )}
          </li>
        ))}
        {items.length > 0 && visible.length === 0 && (
          <li className="py-2 text-footnote text-secondary">
            Nenhum repositório carregado corresponde ao filtro.
          </li>
        )}
      </ul>
      {nextPage && (
        <button
          type="button"
          disabled={loading}
          className={`${secondaryButton} mt-3`}
          onClick={() => void loadPage(nextPage)}
        >
          {loading ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </div>
  )
}
