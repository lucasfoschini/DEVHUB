import { useEffect, useId, useState, type FormEvent } from 'react'
import { Check, Copy, Eye, EyeOff, KeyRound, Plus, RotateCw, Trash2 } from 'lucide-react'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'
import { Field, Loadable, PageShell, Panel } from '../components/page'
import {
  ENV_LABEL,
  ENVIRONMENTS,
  formatDate,
  rowButton,
  useApi,
  type Environment,
} from '../components/page-utils'
import { listProjects, type Project } from '../projects/projects'
import { request } from '../session'

interface Secret {
  id: string
  name: string
  environment: Environment
  description: string
  lastRevealedAt: string | null
  updatedAt: string
  project: { id: string; name: string }
}

/** How long a revealed value stays on screen. */
const REVEAL_MS = 30_000

function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    void listProjects().then((res) => {
      if (res.ok) setProjects(res.data.items.filter((p) => p.status !== 'archived'))
    })
  }, [])
  return projects
}

function errorText(status: number) {
  if (status === 409) return 'Já existe um segredo com esse nome nesse ambiente.'
  if (status === 400) return 'Nome em MAIÚSCULAS_COM_UNDERSCORE e valor obrigatório.'
  if (status === 503) return 'O servidor não tem ENCRYPTION_KEY configurada.'
  if (status === 422) return 'Projeto inválido ou limite atingido.'
  return 'Não foi possível salvar.'
}

function CreateForm(props: { projects: Project[]; onDone: () => void; onCancel: () => void }) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const res = await request('POST', '/api/secrets', {
      projectId: String(f.get('projectId')),
      name: String(f.get('name')).trim().toUpperCase(),
      environment: String(f.get('environment')),
      value: String(f.get('value')),
      description: String(f.get('description') ?? ''),
    })
    setBusy(false)
    if (res.ok) props.onDone()
    else setError(errorText(res.status))
  }

  if (props.projects.length === 0) {
    return (
      <p className="mb-6 rounded-surface border border-subtle bg-surface p-4 text-secondary">
        Crie um projeto antes: cada segredo pertence a um projeto e ambiente.
      </p>
    )
  }
  return (
    <form
      aria-label="Novo segredo"
      onSubmit={(e) => void submit(e)}
      className="mb-6 grid gap-4 rounded-surface border border-subtle bg-surface p-4 motion-safe:animate-rise-in md:grid-cols-2"
    >
      <Field id={`${id}-project`} label="Projeto">
        <select id={`${id}-project`} name="projectId" className={inputClass} required>
          {props.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-env`} label="Ambiente">
        <select
          id={`${id}-env`}
          name="environment"
          className={inputClass}
          defaultValue="development"
        >
          {ENVIRONMENTS.map((e) => (
            <option key={e} value={e}>
              {ENV_LABEL[e]}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${id}-name`} label="Nome" hint="Ex.: DATABASE_URL">
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={128}
          pattern="[A-Za-z_][A-Za-z0-9_]*"
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass} font-mono uppercase`}
        />
      </Field>
      <Field id={`${id}-value`} label="Valor" hint="Criptografado (AES-256-GCM) antes de salvar.">
        <input
          id={`${id}-value`}
          name="value"
          type="password"
          required
          maxLength={10000}
          autoComplete="new-password"
          className={`${inputClass} font-mono`}
        />
      </Field>
      <div className="md:col-span-2">
        <Field id={`${id}-desc`} label="Descrição (opcional)">
          <input id={`${id}-desc`} name="description" maxLength={500} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <button type="submit" className={primaryButton} disabled={busy}>
          Salvar segredo
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

function SecretRow({ s, onChange }: { s: Secret; onChange: () => void }) {
  const [value, setValue] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<'idle' | 'rotate' | 'delete'>('idle')
  const [error, setError] = useState<string | null>(null)
  const rotateId = useId()

  // A revealed value hides itself; it is never kept in state longer than needed.
  useEffect(() => {
    if (value === null) return
    const t = setTimeout(() => setValue(null), REVEAL_MS)
    return () => clearTimeout(t)
  }, [value])

  async function reveal() {
    if (value !== null) return setValue(null)
    const res = await request<{ value: string }>('POST', `/api/secrets/${s.id}/reveal`)
    if (res.ok) setValue(res.data.value)
    else setError(errorText(res.status))
  }

  async function copy() {
    const res = await request<{ value: string }>('POST', `/api/secrets/${s.id}/reveal`)
    if (!res.ok) return setError(errorText(res.status))
    await navigator.clipboard.writeText(res.data.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function rotate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = String(new FormData(e.currentTarget).get('value'))
    const res = await request('PATCH', `/api/secrets/${s.id}`, { value: next })
    if (!res.ok) return setError(errorText(res.status))
    setMode('idle')
    setValue(null)
    onChange()
  }

  async function remove() {
    const res = await request('DELETE', `/api/secrets/${s.id}`)
    if (res.ok || res.status === 204) onChange()
    else setError(errorText(res.status))
  }

  return (
    <li className="border-b border-subtle px-4 py-3 last:border-0 motion-safe:animate-rise-in">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <KeyRound size={16} aria-hidden className="shrink-0 text-tertiary" />
        <span className="min-w-0 font-mono text-body font-medium break-all">{s.name}</span>
        <span className="rounded-full border border-subtle px-2 text-caption text-secondary">
          {ENV_LABEL[s.environment]}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={rowButton}
            onClick={() => void reveal()}
            aria-pressed={value !== null}
          >
            {value === null ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
            {value === null ? 'Revelar' : 'Ocultar'}
            <span className="sr-only"> {s.name}</span>
          </button>
          <button type="button" className={rowButton} onClick={() => void copy()}>
            {copied ? (
              <Check size={14} aria-hidden className="text-success" />
            ) : (
              <Copy size={14} aria-hidden />
            )}
            {copied ? 'Copiado' : 'Copiar'}
            <span className="sr-only"> {s.name}</span>
          </button>
          <button
            type="button"
            className={rowButton}
            onClick={() => setMode(mode === 'rotate' ? 'idle' : 'rotate')}
            aria-expanded={mode === 'rotate'}
          >
            <RotateCw size={14} aria-hidden /> Rotacionar
            <span className="sr-only"> {s.name}</span>
          </button>
          <button
            type="button"
            className={rowButton}
            onClick={() => setMode(mode === 'delete' ? 'idle' : 'delete')}
            aria-expanded={mode === 'delete'}
          >
            <Trash2 size={14} aria-hidden /> Excluir
            <span className="sr-only"> {s.name}</span>
          </button>
        </span>
      </div>
      <p className="mt-1 text-caption text-secondary">
        {[
          s.description,
          `atualizado ${formatDate(s.updatedAt)}`,
          s.lastRevealedAt ? `último acesso ${formatDate(s.lastRevealedAt)}` : 'nunca revelado',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {value !== null && (
        <pre className="mt-2 overflow-x-auto rounded-control bg-canvas px-3 py-2 font-mono text-footnote break-all whitespace-pre-wrap motion-safe:animate-fade-in">
          {value}
        </pre>
      )}
      {mode === 'rotate' && (
        <form
          onSubmit={(e) => void rotate(e)}
          className="mt-2 flex flex-wrap items-end gap-2 motion-safe:animate-rise-in"
        >
          <Field id={rotateId} label="Novo valor">
            <input
              id={rotateId}
              name="value"
              type="password"
              required
              maxLength={10000}
              autoComplete="new-password"
              className={`${inputClass} w-72 max-w-full font-mono`}
            />
          </Field>
          <button type="submit" className={primaryButton}>
            Salvar novo valor
          </button>
        </form>
      )}
      {mode === 'delete' && (
        <div
          role="group"
          aria-label={`Confirmar exclusão de ${s.name}`}
          className="mt-2 flex flex-wrap items-center gap-2 motion-safe:animate-rise-in"
        >
          <span className="text-footnote text-error">
            Excluir {s.name} de {ENV_LABEL[s.environment]}? Não dá para desfazer.
          </span>
          <button type="button" className={secondaryButton} onClick={() => void remove()}>
            Confirmar exclusão
          </button>
          <button type="button" className={rowButton} onClick={() => setMode('idle')}>
            Cancelar
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1 text-footnote text-error">
          {error}
        </p>
      )}
    </li>
  )
}

/** Secrets Vault (MASTER_PLAN §7.10). Values are encrypted on the server, shown only on an
 *  explicit, audited reveal, and hidden again after 30 s. */
export function SecretsPage() {
  const [projectId, setProjectId] = useState('')
  const state = useApi<Secret[]>(`/api/secrets${projectId ? `?projectId=${projectId}` : ''}`)
  const projects = useProjects()
  const [creating, setCreating] = useState(false)
  const filterId = useId()

  return (
    <PageShell
      title="Secrets Vault"
      subtitle="Variáveis sensíveis por projeto e ambiente. Cada leitura fica registrada na auditoria."
      action={
        !creating && (
          <button type="button" className={primaryButton} onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> Novo segredo
          </button>
        )
      }
    >
      {creating && (
        <CreateForm
          projects={projects}
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            state.reload()
          }}
        />
      )}
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor={filterId} className="text-footnote text-secondary">
          Projeto
        </label>
        <select
          id={filterId}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={`${inputClass} h-8`}
        >
          <option value="">Todos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <Loadable state={state} what="os segredos">
        {(secrets) =>
          secrets.length === 0 ? (
            <Panel className="p-6">
              <h2 className="text-headline">Nenhum segredo</h2>
              <p className="mt-1 text-secondary">
                Guarde aqui tokens, URLs de banco e chaves de API. O valor só aparece quando você
                pede, e some depois de 30 segundos.
              </p>
            </Panel>
          ) : (
            <div className="space-y-4">
              {[...new Set(secrets.map((s) => s.project.name))]
                .map((name) => [name, secrets.filter((s) => s.project.name === name)] as const)
                .map(([name, items]) => (
                  <Panel key={name} label={`Segredos de ${name}`}>
                    <h2 className="border-b border-subtle px-4 py-2.5 text-footnote font-semibold">
                      {name}
                    </h2>
                    <ul>
                      {items.map((s) => (
                        <SecretRow key={s.id} s={s} onChange={state.reload} />
                      ))}
                    </ul>
                  </Panel>
                ))}
            </div>
          )
        }
      </Loadable>
    </PageShell>
  )
}
