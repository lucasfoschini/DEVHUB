import { Fragment, useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { FileText, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'
import { Field, Loadable, PageShell, Panel } from '../components/page'
import { formatDate, rowButton, useApi } from '../components/page-utils'
import type { Project } from '../projects/projects'
import { request } from '../session'
import { LocalDocs } from './LocalDocs'
import { parseMarkdown, type Block, type Inline } from './markdown'

interface NoteSummary {
  id: string
  title: string
  pinned: boolean
  updatedAt: string
  project: { id: string; name: string } | null
}
interface Note extends NoteSummary {
  body: string
}

function InlineView({ nodes }: { nodes: Inline[] }) {
  return nodes.map((n, i) => {
    if (n.t === 'text') return <Fragment key={i}>{n.v}</Fragment>
    if (n.t === 'code')
      return (
        <code key={i} className="rounded bg-canvas px-1 py-0.5 font-mono text-[0.9em]">
          {n.v}
        </code>
      )
    if (n.t === 'strong')
      return (
        <strong key={i} className="font-semibold">
          <InlineView nodes={n.c} />
        </strong>
      )
    if (n.t === 'em')
      return (
        <em key={i}>
          <InlineView nodes={n.c} />
        </em>
      )
    const external = /^https?:/i.test(n.href)
    return (
      <a
        key={i}
        href={n.href}
        className="text-primary underline"
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        <InlineView nodes={n.c} />
      </a>
    )
  })
}

function BlockView({ b }: { b: Block }): ReactNode {
  switch (b.t) {
    case 'h': {
      const cls = ['text-title2 mt-6', 'text-title3 mt-5', 'text-headline mt-4'][b.level - 1]
      const Tag = (['h2', 'h3', 'h4'] as const)[b.level - 1]!
      return (
        <Tag className={`${cls} first:mt-0`}>
          <InlineView nodes={b.c} />
        </Tag>
      )
    }
    case 'p':
      return (
        <p className="mt-3 first:mt-0">
          <InlineView nodes={b.c} />
        </p>
      )
    case 'ul':
    case 'ol': {
      const Tag = b.t
      return (
        <Tag className={`mt-3 space-y-1 pl-6 ${b.t === 'ul' ? 'list-disc' : 'list-decimal'}`}>
          {b.items.map((item, i) => (
            <li key={i}>
              <InlineView nodes={item} />
            </li>
          ))}
        </Tag>
      )
    }
    case 'quote':
      return (
        <blockquote className="mt-3 border-l-2 border-subtle pl-3 text-secondary">
          <InlineView nodes={b.c} />
        </blockquote>
      )
    case 'code':
      return (
        <pre className="mt-3 overflow-x-auto rounded-control bg-canvas p-3 font-mono text-footnote">
          <code>{b.v}</code>
        </pre>
      )
    case 'hr':
      return <hr className="my-5 border-subtle" />
  }
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source)
  if (blocks.length === 0) return <p className="text-secondary">Nota vazia.</p>
  return (
    <div className="text-body leading-relaxed">
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </div>
  )
}

function Editor(props: {
  note: Note | null
  projects: Project[]
  onSaved: (id: string) => void
  onCancel: () => void
}) {
  const id = useId()
  const [body, setBody] = useState(props.note?.body ?? '')
  const [error, setError] = useState<string | null>(null)

  async function save(form: HTMLFormElement) {
    const f = new FormData(form)
    const data = {
      title: String(f.get('title')),
      body,
      projectId: String(f.get('projectId')) || null,
    }
    const res = props.note
      ? await request<Note>('PATCH', `/api/notes/${props.note.id}`, data)
      : await request<Note>('POST', '/api/notes', data)
    if (res.ok) props.onSaved(res.data.id)
    else setError(res.status === 400 ? 'Informe um título.' : 'Não foi possível salvar.')
  }

  return (
    <form
      aria-label={props.note ? 'Editar nota' : 'Nova nota'}
      onSubmit={(e) => {
        e.preventDefault()
        void save(e.currentTarget)
      }}
      className="flex flex-col gap-4 motion-safe:animate-rise-in"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
        <Field id={`${id}-title`} label="Título">
          <input
            id={`${id}-title`}
            name="title"
            required
            maxLength={160}
            defaultValue={props.note?.title}
            className={inputClass}
          />
        </Field>
        <Field id={`${id}-project`} label="Projeto">
          <select
            id={`${id}-project`}
            name="projectId"
            defaultValue={props.note?.project?.id ?? ''}
            className={inputClass}
          >
            <option value="">Nenhum</option>
            {props.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field id={`${id}-body`} label="Conteúdo (Markdown)">
          <textarea
            id={`${id}-body`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={100000}
            rows={18}
            spellCheck
            className={`${inputClass} h-auto min-h-80 py-2 font-mono text-footnote`}
          />
        </Field>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-footnote font-medium">Pré-visualização</span>
          <div className="min-h-80 overflow-auto rounded-control border border-subtle p-3">
            <Markdown source={body} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" className={primaryButton}>
          Salvar nota
        </button>
        <button type="button" className={secondaryButton} onClick={props.onCancel}>
          Cancelar
        </button>
        {error && (
          <p role="alert" className="text-footnote text-error">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}

/** Knowledge Base (MASTER_PLAN §7.8): Markdown notes with search and a comfortable reader. */
export function KnowledgePage() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<'read' | 'edit' | 'new'>('read')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const searchId = useId()

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const list = useApi<NoteSummary[]>(
    `/api/notes${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`,
  )
  const current = useApi<Note>(selected ? `/api/notes/${selected}` : null)
  const projects = useApi<{ items: Project[] }>('/api/projects?limit=100')
  const projectList = (projects.data?.items ?? []).filter((p) => p.status !== 'archived')
  const note = selected && current.data?.id === selected ? current.data : null

  const saved = (id: string) => {
    setMode('read')
    setSelected(id)
    list.reload()
    current.reload()
  }

  async function togglePin(n: Note) {
    await request('PATCH', `/api/notes/${n.id}`, { pinned: !n.pinned })
    list.reload()
    current.reload()
  }

  async function remove(n: Note) {
    await request('DELETE', `/api/notes/${n.id}`)
    setSelected(null)
    setConfirmDelete(false)
    list.reload()
  }

  return (
    <PageShell
      title="Knowledge Base"
      subtitle="Runbooks, decisões e anotações em Markdown, por projeto."
      wide
      action={
        mode !== 'new' && (
          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              setMode('new')
              setSelected(null)
            }}
          >
            <Plus size={16} aria-hidden /> Nova nota
          </button>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel label="Notas" className="self-start">
          <div className="relative border-b border-subtle p-2">
            <label htmlFor={searchId} className="sr-only">
              Buscar notas
            </label>
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4.5 -translate-y-1/2 text-tertiary"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar em títulos e conteúdo"
              className={`${inputClass} h-8 w-full pl-8`}
            />
          </div>
          <Loadable state={list} what="as notas">
            {(notes) =>
              notes.length === 0 ? (
                <p className="p-4 text-footnote text-secondary">
                  {debounced ? 'Nada encontrado.' : 'Nenhuma nota ainda.'}
                </p>
              ) : (
                <ul className="max-h-[60vh] overflow-y-auto p-1">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        aria-current={selected === n.id ? 'true' : undefined}
                        onClick={() => {
                          setSelected(n.id)
                          setMode('read')
                          setConfirmDelete(false)
                        }}
                        className="flex w-full items-start gap-2 rounded-control px-2.5 py-2 text-left hover:bg-hover aria-[current]:bg-selected"
                      >
                        {n.pinned ? (
                          <Pin
                            size={14}
                            aria-label="Fixada"
                            className="mt-0.5 shrink-0 text-primary"
                          />
                        ) : (
                          <FileText
                            size={14}
                            aria-hidden
                            className="mt-0.5 shrink-0 text-tertiary"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-body">{n.title}</span>
                          <span className="block truncate text-caption text-secondary">
                            {[n.project?.name, formatDate(n.updatedAt)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            }
          </Loadable>
        </Panel>

        <Panel label="Leitura" className="min-h-96 p-5 md:p-8">
          {mode === 'new' ? (
            <Editor
              note={null}
              projects={projectList}
              onSaved={saved}
              onCancel={() => setMode('read')}
            />
          ) : mode === 'edit' && note ? (
            <Editor
              note={note}
              projects={projectList}
              onSaved={saved}
              onCancel={() => setMode('read')}
            />
          ) : note ? (
            <article key={note.id} className="mx-auto max-w-[68ch] motion-safe:animate-rise-in">
              <header className="mb-6 border-b border-subtle pb-4">
                <h2 className="text-title1">{note.title}</h2>
                <p className="mt-1 text-footnote text-secondary">
                  {note.project && (
                    <>
                      <Link to={`/projects/${note.project.id}`} className="underline">
                        {note.project.name}
                      </Link>
                      {' · '}
                    </>
                  )}
                  Atualizada {formatDate(note.updatedAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <button type="button" className={rowButton} onClick={() => setMode('edit')}>
                    <Pencil size={14} aria-hidden /> Editar
                  </button>
                  <button type="button" className={rowButton} onClick={() => void togglePin(note)}>
                    {note.pinned ? <PinOff size={14} aria-hidden /> : <Pin size={14} aria-hidden />}
                    {note.pinned ? 'Desafixar' : 'Fixar'}
                  </button>
                  {confirmDelete ? (
                    <button
                      type="button"
                      className={`${rowButton} text-error`}
                      onClick={() => void remove(note)}
                    >
                      Confirmar exclusão
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={rowButton}
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={14} aria-hidden /> Excluir
                    </button>
                  )}
                </div>
              </header>
              <Markdown source={note.body} />
            </article>
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <FileText size={28} aria-hidden className="mx-auto text-tertiary" />
                <p className="mt-2 text-secondary">Escolha uma nota ou crie uma nova.</p>
              </div>
            </div>
          )}
        </Panel>
      </div>
      <LocalDocs onImported={saved} />
    </PageShell>
  )
}
