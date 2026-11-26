import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Pencil, Plus, Server as ServerIcon, Trash2 } from 'lucide-react'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'
import { Field, Loadable, PageShell, Panel } from '../components/page'
import {
  ENV_LABEL,
  ENVIRONMENTS,
  rowButton,
  useApi,
  type Environment,
} from '../components/page-utils'
import { StateBadge } from '../monitors/MonitorsPage'
import type { Monitor } from '../monitors/monitors'
import type { Project } from '../projects/projects'
import { request } from '../session'

interface Server {
  id: string
  name: string
  host: string
  provider: string
  environment: Environment
  notes: string
  project: { id: string; name: string } | null
}

function errorText(status: number) {
  if (status === 409) return 'Já existe um servidor com esse nome.'
  if (status === 400) return 'Confira nome e host (hostname ou IP, sem espaços).'
  if (status === 422) return 'Projeto inválido ou limite atingido.'
  return 'Não foi possível salvar.'
}

function ServerForm(props: {
  initial?: Server
  projects: Project[]
  onDone: () => void
  onCancel: () => void
}) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const s = props.initial

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = {
      name: String(f.get('name')),
      host: String(f.get('host')),
      provider: String(f.get('provider')),
      environment: String(f.get('environment')),
      notes: String(f.get('notes')),
      projectId: String(f.get('projectId')) || null,
    }
    const res = s
      ? await request('PATCH', `/api/servers/${s.id}`, body)
      : await request('POST', '/api/servers', body)
    if (res.ok) props.onDone()
    else setError(errorText(res.status))
  }

  return (
    <form
      aria-label={s ? `Editar ${s.name}` : 'Novo servidor'}
      onSubmit={(e) => void submit(e)}
      className="grid gap-4 rounded-surface border border-subtle bg-surface p-4 motion-safe:animate-rise-in md:grid-cols-3"
    >
      <Field id={`${id}-name`} label="Nome">
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={80}
          defaultValue={s?.name}
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-host`} label="Host" hint="Hostname ou IP. O DevHub não se conecta a ele.">
        <input
          id={`${id}-host`}
          name="host"
          required
          maxLength={253}
          defaultValue={s?.host}
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
      </Field>
      <Field id={`${id}-provider`} label="Provedor">
        <input
          id={`${id}-provider`}
          name="provider"
          maxLength={60}
          defaultValue={s?.provider}
          placeholder="Hetzner, AWS, VPS…"
          className={inputClass}
        />
      </Field>
      <Field id={`${id}-env`} label="Ambiente">
        <select
          id={`${id}-env`}
          name="environment"
          defaultValue={s?.environment ?? 'production'}
          className={inputClass}
        >
          {ENVIRONMENTS.map((e) => (
            <option key={e} value={e}>
              {ENV_LABEL[e]}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-project`} label="Projeto">
        <select
          id={`${id}-project`}
          name="projectId"
          defaultValue={s?.project?.id ?? ''}
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
      <Field id={`${id}-notes`} label="Notas">
        <input
          id={`${id}-notes`}
          name="notes"
          maxLength={2000}
          defaultValue={s?.notes}
          className={inputClass}
        />
      </Field>
      <div className="flex items-center gap-2 md:col-span-3">
        <button type="submit" className={primaryButton}>
          {s ? 'Salvar' : 'Adicionar servidor'}
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

/** Infrastructure (MASTER_PLAN §7.5), inventory level: servers you declare, grouped by
 *  environment, with the reachability that HTTP monitors of the same project observe. */
export function InfrastructurePage() {
  const servers = useApi<Server[]>('/api/servers')
  const projects = useApi<{ items: Project[] }>('/api/projects?limit=100')
  const monitors = useApi<Monitor[]>('/api/monitors')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const projectList = (projects.data?.items ?? []).filter((p) => p.status !== 'archived')

  const done = () => {
    setEditing(null)
    servers.reload()
  }

  return (
    <PageShell
      title="Infraestrutura"
      subtitle="Servidores por ambiente. Métricas de CPU e disco chegam com o Local Agent (Fase 5)."
      action={
        editing === null && (
          <button type="button" className={primaryButton} onClick={() => setEditing('new')}>
            <Plus size={16} aria-hidden /> Novo servidor
          </button>
        )
      }
    >
      {editing === 'new' && (
        <div className="mb-6">
          <ServerForm projects={projectList} onDone={done} onCancel={() => setEditing(null)} />
        </div>
      )}
      <Loadable state={servers} what="os servidores">
        {(list) =>
          list.length === 0 ? (
            <Panel className="p-6">
              <h2 className="text-headline">Nenhum servidor</h2>
              <p className="mt-1 text-secondary">
                Registre VPS, instâncias e máquinas do home lab. Vincule a um projeto para ver o
                estado dos monitores HTTP dele aqui.
              </p>
            </Panel>
          ) : (
            <div className="space-y-6">
              {ENVIRONMENTS.filter((env) => list.some((s) => s.environment === env)).map((env) => (
                <section key={env} aria-labelledby={`env-${env}`}>
                  <h2 id={`env-${env}`} className="mb-2 text-headline">
                    {ENV_LABEL[env]}
                  </h2>
                  <Panel>
                    <ul>
                      {list
                        .filter((s) => s.environment === env)
                        .map((s) =>
                          editing === s.id ? (
                            <li key={s.id} className="p-2">
                              <ServerForm
                                initial={s}
                                projects={projectList}
                                onDone={done}
                                onCancel={() => setEditing(null)}
                              />
                            </li>
                          ) : (
                            <li
                              key={s.id}
                              className="border-b border-subtle px-4 py-3 last:border-0 motion-safe:animate-rise-in"
                            >
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <ServerIcon size={16} aria-hidden className="text-tertiary" />
                                <span className="font-medium">{s.name}</span>
                                <span className="font-mono text-footnote text-secondary">
                                  {s.host}
                                </span>
                                {s.provider && (
                                  <span className="rounded-full border border-subtle px-2 text-caption text-secondary">
                                    {s.provider}
                                  </span>
                                )}
                                <span className="ml-auto flex items-center gap-1">
                                  <button
                                    type="button"
                                    className={rowButton}
                                    onClick={() => setEditing(s.id)}
                                  >
                                    <Pencil size={14} aria-hidden /> Editar
                                    <span className="sr-only"> {s.name}</span>
                                  </button>
                                  {confirm === s.id ? (
                                    <button
                                      type="button"
                                      className={`${rowButton} text-error`}
                                      onClick={() =>
                                        void request('DELETE', `/api/servers/${s.id}`).then(done)
                                      }
                                    >
                                      Confirmar exclusão
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className={rowButton}
                                      onClick={() => setConfirm(s.id)}
                                    >
                                      <Trash2 size={14} aria-hidden /> Excluir
                                      <span className="sr-only"> {s.name}</span>
                                    </button>
                                  )}
                                </span>
                              </div>
                              {(s.project || s.notes) && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-secondary">
                                  {s.project && (
                                    <Link
                                      to={`/projects/${s.project.id}`}
                                      className="underline hover:text-primary"
                                    >
                                      {s.project.name}
                                    </Link>
                                  )}
                                  {(monitors.data ?? [])
                                    .filter((m) => s.project && m.project?.id === s.project.id)
                                    .map((m) => (
                                      <Link
                                        key={m.id}
                                        to={`/observability/${m.id}`}
                                        className="inline-flex items-center gap-1.5 hover:text-primary"
                                      >
                                        <span className="underline">{m.name}</span>
                                        <StateBadge state={m.state} enabled={m.enabled} />
                                      </Link>
                                    ))}
                                  {s.notes && <span>{s.notes}</span>}
                                </div>
                              )}
                            </li>
                          ),
                        )}
                    </ul>
                  </Panel>
                </section>
              ))}
            </div>
          )
        }
      </Loadable>
    </PageShell>
  )
}
