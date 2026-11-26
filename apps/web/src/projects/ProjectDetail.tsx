import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Archive, ArchiveRestore, ChevronLeft } from 'lucide-react'
import {
  errorMessage,
  getProject,
  STATUS_META,
  STATUSES,
  updateProject,
  type Project,
} from './projects'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'
import { StatusBadge } from './ProjectsPage'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

export function ProjectDetail() {
  const { id = '' } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const field = useId()

  useEffect(() => {
    let live = true
    void getProject(id).then((res) => {
      if (!live) return
      if (res.ok) setProject(res.data)
      // A malformed id is answered with 400; to the user it is the same as a missing project.
      else setLoadError(errorMessage(res.status === 400 ? 404 : res.status))
    })
    return () => {
      live = false
    }
  }, [id])

  async function save(body: Parameters<typeof updateProject>[1]) {
    setBusy(true)
    setSaveError(null)
    setSaved(false)
    const res = await updateProject(id, body)
    setBusy(false)
    if (!res.ok) return setSaveError(errorMessage(res.status))
    setProject(res.data)
    setSaved(true)
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    void save({
      name: String(form.get('name')),
      description: String(form.get('description')),
      status: form.get('status') as Project['status'],
    })
  }

  const back = (
    <Link
      to="/projects"
      className="mb-4 inline-flex items-center gap-1 text-footnote text-secondary hover:text-primary"
    >
      <ChevronLeft size={14} aria-hidden /> Projetos
    </Link>
  )

  if (loadError || !project) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-10">
        {back}
        <h1 tabIndex={-1} data-page-title className="text-title1 outline-none">
          {loadError ? 'Projeto indisponível' : 'Carregando…'}
        </h1>
        {loadError && (
          <p role="alert" className="mt-2 text-secondary">
            {loadError}
          </p>
        )}
      </div>
    )
  }

  const archived = project.status === 'archived'

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-10">
      {back}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 tabIndex={-1} data-page-title className="truncate text-title1 outline-none">
            {project.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge status={project.status} />
            <span className="text-footnote text-secondary">
              Atualizado em {dateTime.format(new Date(project.updatedAt))}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          className={secondaryButton}
          onClick={() => void save({ status: archived ? 'planning' : 'archived' })}
        >
          {archived ? (
            <>
              <ArchiveRestore size={16} aria-hidden /> Restaurar
            </>
          ) : (
            <>
              <Archive size={16} aria-hidden /> Arquivar
            </>
          )}
        </button>
      </header>

      {/* key: remount the uncontrolled form when the saved project changes (e.g. archive). */}
      <form
        key={project.updatedAt}
        onSubmit={submit}
        aria-label="Editar projeto"
        className="space-y-4 rounded-surface border border-subtle bg-surface p-5"
      >
        <div className="space-y-1">
          <label htmlFor={`${field}-name`} className="text-footnote font-medium">
            Nome
          </label>
          <input
            id={`${field}-name`}
            name="name"
            required
            maxLength={80}
            defaultValue={project.name}
            className={`${inputClass} w-full`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${field}-description`} className="text-footnote font-medium">
            Descrição
          </label>
          <textarea
            id={`${field}-description`}
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={project.description}
            className={`${inputClass} h-auto w-full py-2`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${field}-status`} className="text-footnote font-medium">
            Status
          </label>
          <select
            id={`${field}-status`}
            name="status"
            defaultValue={project.status}
            className={`${inputClass} block`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
        <p role="alert" className="text-footnote text-error empty:hidden">
          {saveError}
        </p>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
          <span role="status" className="text-footnote text-success">
            {saved ? 'Salvo.' : ''}
          </span>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="text-headline">Repositórios, ambientes e monitores</h2>
        <p className="mt-1 text-secondary">
          Vínculos chegam com a integração GitHub e os monitores HTTP (Fase 2).
        </p>
      </section>
    </div>
  )
}
