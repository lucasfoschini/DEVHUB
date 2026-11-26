import { useId, useState, type FormEvent } from 'react'
import { Check, Copy, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'
import { Field, Loadable, PageShell, Panel } from '../components/page'
import { formatDate, rowButton, useApi } from '../components/page-utils'
import type { Project } from '../projects/projects'
import { request } from '../session'

interface Prompt {
  id: string
  title: string
  body: string
  tags: string[]
  updatedAt: string
  project: { id: string; name: string } | null
}

/** Distinct {{variable}} names in order of appearance. */
const variablesOf = (body: string) => [
  ...new Set([...body.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1]!)),
]
const fill = (body: string, values: Record<string, string>) =>
  body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (all, name: string) => values[name] || all)

function PromptForm(props: {
  initial?: Prompt
  projects: Project[]
  onDone: () => void
  onCancel: () => void
}) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const p = props.initial

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const data = {
      title: String(f.get('title')),
      body: String(f.get('body')),
      tags: String(f.get('tags'))
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10),
      projectId: String(f.get('projectId')) || null,
    }
    const res = p
      ? await request('PATCH', `/api/prompts/${p.id}`, data)
      : await request('POST', '/api/prompts', data)
    if (res.ok) props.onDone()
    else
      setError(res.status === 409 ? 'Já existe um prompt com esse título.' : 'Confira os campos.')
  }

  return (
    <form
      aria-label={p ? `Editar ${p.title}` : 'Novo prompt'}
      onSubmit={(e) => void submit(e)}
      className="grid gap-4 rounded-surface border border-subtle bg-surface p-4 motion-safe:animate-rise-in md:grid-cols-2"
    >
      <Field id={`${id}-title`} label="Título">
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={120}
          defaultValue={p?.title}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-project`} label="Projeto">
        <select
          id={`${id}-project`}
          name="projectId"
          defaultValue={p?.project?.id ?? ''}
          className={inputClass}
        >
          <option value="">Nenhum</option>
          {props.projects.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field
          id={`${id}-body`}
          label="Prompt"
          hint="Use {{nome}} para variáveis preenchidas na hora de usar."
        >
          <textarea
            id={`${id}-body`}
            name="body"
            required
            maxLength={20000}
            rows={8}
            defaultValue={p?.body}
            className={`${inputClass} h-auto py-2 font-mono text-footnote`}
          />
        </Field>
      </div>
      <Field id={`${id}-tags`} label="Tags" hint="Separadas por vírgula.">
        <input
          id={`${id}-tags`}
          name="tags"
          defaultValue={p?.tags.join(', ')}
          className={inputClass}
        />
      </Field>
      <div className="flex items-end gap-2">
        <button type="submit" className={primaryButton}>
          {p ? 'Salvar' : 'Criar prompt'}
        </button>
        <button type="button" className={secondaryButton} onClick={props.onCancel}>
          Cancelar
        </button>
      </div>
      {error && (
        <p role="alert" className="text-footnote text-error md:col-span-2">
          {error}
        </p>
      )}
    </form>
  )
}

function UsePrompt({ prompt }: { prompt: Prompt }) {
  const vars = variablesOf(prompt.body)
  const [values, setValues] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)
  const id = useId()
  const output = fill(prompt.body, values)

  return (
    <div className="grid gap-4 border-t border-subtle p-4 motion-safe:animate-rise-in lg:grid-cols-[260px_1fr]">
      <div className="flex flex-col gap-3">
        {vars.length === 0 ? (
          <p className="text-footnote text-secondary">Este prompt não tem variáveis.</p>
        ) : (
          vars.map((v) => (
            <Field key={v} id={`${id}-${v}`} label={v}>
              <textarea
                id={`${id}-${v}`}
                rows={2}
                value={values[v] ?? ''}
                onChange={(e) => setValues({ ...values, [v]: e.target.value })}
                className={`${inputClass} h-auto py-1.5 text-footnote`}
              />
            </Field>
          ))
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <pre className="max-h-80 overflow-auto rounded-control bg-canvas p-3 font-mono text-footnote whitespace-pre-wrap">
          {output}
        </pre>
        <div>
          <button
            type="button"
            className={secondaryButton}
            onClick={() =>
              void navigator.clipboard.writeText(output).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }
          >
            {copied ? (
              <Check size={16} aria-hidden className="text-success" />
            ) : (
              <Copy size={16} aria-hidden />
            )}
            {copied ? 'Copiado' : 'Copiar prompt preenchido'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** AI Center (MASTER_PLAN §7.7), first slice: a prompt library with variables per project.
 *  Running prompts against a model needs a provider key and the AI gateway (Phase 6). */
export function AiCenterPage() {
  const state = useApi<Prompt[]>('/api/prompts')
  const projects = useApi<{ items: Project[] }>('/api/projects?limit=100')
  const projectList = (projects.data?.items ?? []).filter((p) => p.status !== 'archived')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [using, setUsing] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)

  const done = () => {
    setEditing(null)
    state.reload()
  }

  return (
    <PageShell
      title="AI Center"
      subtitle="Biblioteca de prompts reutilizáveis com variáveis. Execução direta em modelos chega na Fase 6."
      action={
        editing === null && (
          <button type="button" className={primaryButton} onClick={() => setEditing('new')}>
            <Plus size={16} aria-hidden /> Novo prompt
          </button>
        )
      }
    >
      {editing === 'new' && (
        <div className="mb-6">
          <PromptForm projects={projectList} onDone={done} onCancel={() => setEditing(null)} />
        </div>
      )}
      <Loadable state={state} what="os prompts">
        {(prompts) => {
          const tags = [...new Set(prompts.flatMap((p) => p.tags))].sort()
          const shown = tag ? prompts.filter((p) => p.tags.includes(tag)) : prompts
          return prompts.length === 0 ? (
            <Panel className="p-6">
              <h2 className="text-headline">Nenhum prompt</h2>
              <p className="mt-1 text-secondary">
                Guarde prompts de revisão de código, geração de testes ou documentação, com
                variáveis como {'{{diff}}'} ou {'{{arquivo}}'}.
              </p>
            </Panel>
          ) : (
            <>
              {tags.length > 0 && (
                <div
                  role="group"
                  aria-label="Filtrar por tag"
                  className="mb-3 flex flex-wrap gap-1.5"
                >
                  {[null, ...tags].map((t) => (
                    <button
                      key={t ?? 'all'}
                      type="button"
                      aria-pressed={tag === t}
                      onClick={() => setTag(t)}
                      className="h-7 rounded-full border border-subtle px-3 text-footnote text-secondary hover:bg-hover aria-pressed:border-action aria-pressed:bg-selected aria-pressed:text-primary"
                    >
                      {t ?? 'Todas'}
                    </button>
                  ))}
                </div>
              )}
              <Panel label="Prompts">
                <ul>
                  {shown.map((p) =>
                    editing === p.id ? (
                      <li key={p.id} className="p-2">
                        <PromptForm
                          initial={p}
                          projects={projectList}
                          onDone={done}
                          onCancel={() => setEditing(null)}
                        />
                      </li>
                    ) : (
                      <li
                        key={p.id}
                        className="border-b border-subtle last:border-0 motion-safe:animate-rise-in"
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                          <Sparkles size={16} aria-hidden className="text-tertiary" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{p.title}</span>
                            <span className="block truncate text-caption text-secondary">
                              {[
                                p.project?.name,
                                variablesOf(p.body)
                                  .map((v) => `{{${v}}}`)
                                  .join(' '),
                                formatDate(p.updatedAt),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          {p.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-subtle px-2 text-caption text-secondary"
                            >
                              {t}
                            </span>
                          ))}
                          <span className="flex items-center gap-1">
                            <button
                              type="button"
                              className={rowButton}
                              aria-expanded={using === p.id}
                              onClick={() => setUsing(using === p.id ? null : p.id)}
                            >
                              Usar<span className="sr-only"> {p.title}</span>
                            </button>
                            <button
                              type="button"
                              className={rowButton}
                              onClick={() => setEditing(p.id)}
                            >
                              <Pencil size={14} aria-hidden /> Editar
                              <span className="sr-only"> {p.title}</span>
                            </button>
                            {confirm === p.id ? (
                              <button
                                type="button"
                                className={`${rowButton} text-error`}
                                onClick={() =>
                                  void request('DELETE', `/api/prompts/${p.id}`).then(done)
                                }
                              >
                                Confirmar exclusão
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={rowButton}
                                onClick={() => setConfirm(p.id)}
                              >
                                <Trash2 size={14} aria-hidden /> Excluir
                                <span className="sr-only"> {p.title}</span>
                              </button>
                            )}
                          </span>
                        </div>
                        {using === p.id && <UsePrompt prompt={p} />}
                      </li>
                    ),
                  )}
                </ul>
              </Panel>
            </>
          )
        }}
      </Loadable>
    </PageShell>
  )
}
