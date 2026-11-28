import { useId, useState, type FormEvent } from 'react'
import { Switch } from 'radix-ui'
import { ChevronDown, Plus, Send, Trash2, Workflow } from 'lucide-react'
import { inputClass, primaryButton, secondaryButton } from '../components/formStyles'
import { Field, Loadable, PageShell, Panel } from '../components/page'
import { formatDate, rowButton, useApi } from '../components/page-utils'
import { ERROR_LABEL } from '../monitors/monitors'
import { request } from '../session'

type RunStatus = 'pending' | 'succeeded' | 'failed'

interface Automation {
  id: string
  name: string
  trigger: string
  condition: string | null
  intervalMinutes: number | null
  action: 'webhook' | 'notification'
  url: string | null
  format: 'generic' | 'slack' | 'discord'
  message: string | null
  enabled: boolean
  runs: { status: RunStatus; createdAt: string }[]
}
interface Run {
  id: string
  status: RunStatus
  attempts: number
  statusCode: number | null
  error: string | null
  createdAt: string
  finishedAt: string | null
}

const EVENTS: Record<string, string> = {
  'monitor.down': 'Monitor fora do ar',
  'monitor.recovered': 'Monitor recuperado',
  'integration.needs_reconnect': 'Integração desconectada',
}
const TRIGGERS: Record<string, string> = {
  ...EVENTS,
  schedule: 'Agendado (a cada N minutos)',
  manual: 'Manual (botão Executar)',
}
const ACTIONS = { webhook: 'Enviar webhook', notification: 'Notificação no DevHub' } as const
const FORMATS = { generic: 'JSON do DevHub', slack: 'Slack', discord: 'Discord' } as const
const RUN_META: Record<RunStatus, { label: string; color: string }> = {
  pending: { label: 'Na fila', color: 'text-pending' },
  succeeded: { label: 'Entregue', color: 'text-success' },
  failed: { label: 'Falhou', color: 'text-error' },
}

/** "Monitor fora do ar · contém “api” → Slack · hooks.slack.com" */
function describe(a: Automation) {
  const when =
    a.trigger === 'schedule'
      ? `A cada ${a.intervalMinutes} min`
      : (TRIGGERS[a.trigger] ?? a.trigger)
  const cond = a.condition ? ` · contém “${a.condition}”` : ''
  const then =
    a.action === 'notification'
      ? 'Notificação no DevHub'
      : `${FORMATS[a.format]} · ${a.url ? new URL(a.url).host : ''}`
  return `${when}${cond} → ${then}`
}

function RunStatusLabel({ status }: { status: RunStatus }) {
  const m = RUN_META[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-footnote whitespace-nowrap text-secondary">
      <span className={`size-2 rounded-full bg-current ${m.color}`} aria-hidden />
      {m.label}
    </span>
  )
}

function CreateForm(props: { onDone: () => void; onCancel: () => void }) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState('monitor.down')
  const [action, setAction] = useState<keyof typeof ACTIONS>('webhook')
  const isEvent = trigger in EVENTS

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const opt = (k: string) => (f.get(k) ? String(f.get(k)) : null)
    const res = await request('POST', '/api/automations', {
      name: String(f.get('name')),
      trigger,
      action,
      condition: isEvent ? opt('condition') : null,
      intervalMinutes: trigger === 'schedule' ? Number(f.get('interval')) : null,
      message: opt('message'),
      ...(action === 'webhook' && { format: String(f.get('format')), url: String(f.get('url')) }),
    })
    if (res.ok) props.onDone()
    else
      setError(
        res.status === 409
          ? 'Já existe uma automação com esse nome.'
          : action === 'webhook'
            ? 'Use uma URL http(s) sem usuário e senha.'
            : 'Confira os campos.',
      )
  }

  return (
    <form
      aria-label="Nova automação"
      onSubmit={(e) => void submit(e)}
      className="mb-6 grid gap-4 rounded-surface border border-subtle bg-surface p-4 motion-safe:animate-rise-in md:grid-cols-2"
    >
      <Field id={`${id}-name`} label="Nome">
        <input id={`${id}-name`} name="name" required maxLength={80} className={inputClass} />
      </Field>
      <Field id={`${id}-trigger`} label="Quando">
        <select
          id={`${id}-trigger`}
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          className={inputClass}
        >
          {Object.entries(TRIGGERS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {isEvent ? (
        <Field
          id={`${id}-condition`}
          label="Só se o aviso contiver (opcional)"
          hint="Texto no título ou na descrição, sem diferenciar maiúsculas."
        >
          <input id={`${id}-condition`} name="condition" maxLength={200} className={inputClass} />
        </Field>
      ) : trigger === 'schedule' ? (
        <Field id={`${id}-interval`} label="Intervalo (minutos)" hint="De 5 a 1440.">
          <input
            id={`${id}-interval`}
            name="interval"
            type="number"
            required
            min={5}
            max={1440}
            defaultValue={60}
            className={inputClass}
          />
        </Field>
      ) : (
        <div />
      )}
      <Field id={`${id}-action`} label="Então">
        <select
          id={`${id}-action`}
          value={action}
          onChange={(e) => setAction(e.target.value as keyof typeof ACTIONS)}
          className={inputClass}
        >
          {Object.entries(ACTIONS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id={`${id}-message`}
        label={isEvent ? 'Título no lugar do aviso (opcional)' : 'Mensagem (opcional)'}
      >
        <input id={`${id}-message`} name="message" maxLength={200} className={inputClass} />
      </Field>
      {action === 'webhook' && (
        <>
          <Field
            id={`${id}-url`}
            label="Enviar POST para"
            hint="Endereços de rede privada são bloqueados na entrega."
          >
            <input
              id={`${id}-url`}
              name="url"
              type="url"
              required
              maxLength={2048}
              placeholder="https://hooks.slack.com/services/…"
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Field id={`${id}-format`} label="Formato">
            <select id={`${id}-format`} name="format" className={inputClass}>
              {Object.entries(FORMATS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      <div className="flex items-center gap-2 md:col-span-2">
        <button type="submit" className={primaryButton}>
          Criar automação
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

function Runs({ id }: { id: string }) {
  const runs = useApi<Run[]>(`/api/automations/${id}/runs`)
  return (
    <div className="border-t border-subtle bg-canvas/40 px-4 py-3 motion-safe:animate-rise-in">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-caption font-semibold text-secondary">Histórico de entregas</h3>
        <button type="button" className={rowButton} onClick={runs.reload}>
          Atualizar
        </button>
      </div>
      <Loadable state={runs} what="o histórico">
        {(list) =>
          list.length === 0 ? (
            <p className="text-footnote text-secondary">Nenhuma execução ainda.</p>
          ) : (
            <table className="w-full text-left text-footnote">
              <thead className="text-caption text-secondary">
                <tr>
                  <th scope="col" className="py-1 font-medium">
                    Quando
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Resultado
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Detalhe
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Tentativas
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-subtle">
                    <td className="py-1.5 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="py-1.5">
                      <RunStatusLabel status={r.status} />
                    </td>
                    <td className="py-1.5 text-secondary">
                      {r.statusCode !== null && `HTTP ${r.statusCode}`}
                      {r.error && ` ${ERROR_LABEL[r.error] ?? r.error}`}
                    </td>
                    <td className="py-1.5 text-right tabular">{r.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </Loadable>
    </div>
  )
}

function AutomationRow({ a, onChange }: { a: Automation; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const switchId = useId()
  const last = a.runs[0]

  const runNow = a.trigger === 'schedule' || a.trigger === 'manual'

  async function test() {
    setNotice(runNow ? 'Executando…' : 'Enviando teste…')
    const res = await request<Run>('POST', `/api/automations/${a.id}/test`)
    const r = res.data
    setNotice(
      !res.ok
        ? 'Não foi possível enviar o teste.'
        : r.status === 'succeeded'
          ? r.statusCode === null
            ? 'Notificação criada.'
            : `${runNow ? 'Executado' : 'Teste entregue'} (HTTP ${r.statusCode}).`
          : `Falhou: ${r.statusCode ? `HTTP ${r.statusCode}` : (ERROR_LABEL[r.error ?? ''] ?? r.error)}. Novas tentativas em 30 s.`,
    )
    setOpen(true)
    onChange()
  }

  return (
    <li className="border-b border-subtle last:border-0 motion-safe:animate-rise-in">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <Workflow size={16} aria-hidden className="text-tertiary" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{a.name}</span>
          <span className="block truncate text-caption text-secondary">{describe(a)}</span>
        </span>
        {last && <RunStatusLabel status={last.status} />}
        <span className="flex items-center gap-2">
          <label htmlFor={switchId} className="text-footnote text-secondary">
            Ativa
          </label>
          <Switch.Root
            id={switchId}
            checked={a.enabled}
            onCheckedChange={(on) =>
              void request('PATCH', `/api/automations/${a.id}`, { enabled: on }).then(onChange)
            }
            className="relative h-5.5 w-9 shrink-0 rounded-full border border-control bg-surface transition-colors duration-(--dh-duration-fast) data-[state=checked]:border-action data-[state=checked]:bg-action"
          >
            <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-secondary transition-transform duration-(--dh-duration-fast) ease-standard data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-action-fg" />
          </Switch.Root>
        </span>
        <span className="flex items-center gap-1">
          <button type="button" className={rowButton} onClick={() => void test()}>
            <Send size={14} aria-hidden /> {runNow ? 'Executar agora' : 'Testar'}
            <span className="sr-only"> {a.name}</span>
          </button>
          <button
            type="button"
            className={rowButton}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <ChevronDown
              size={14}
              aria-hidden
              className={`transition-transform duration-(--dh-duration-fast) ${open ? 'rotate-180' : ''}`}
            />
            Histórico
            <span className="sr-only"> de {a.name}</span>
          </button>
          {confirm ? (
            <button
              type="button"
              className={`${rowButton} text-error`}
              onClick={() => void request('DELETE', `/api/automations/${a.id}`).then(onChange)}
            >
              Confirmar exclusão
            </button>
          ) : (
            <button type="button" className={rowButton} onClick={() => setConfirm(true)}>
              <Trash2 size={14} aria-hidden /> Excluir
              <span className="sr-only"> {a.name}</span>
            </button>
          )}
        </span>
      </div>
      {notice && (
        <p role="status" className="px-4 pb-2 text-footnote text-secondary">
          {notice}
        </p>
      )}
      {open && <Runs id={a.id} />}
    </li>
  )
}

/** Automations (MASTER_PLAN §7.9): trigger (event, schedule, manual) → optional text condition →
 *  action (webhook with retries, or in-app notification), with a run history. */
export function AutomationsPage() {
  const state = useApi<Automation[]>('/api/automations')
  const [creating, setCreating] = useState(false)

  return (
    <PageShell
      title="Automações"
      subtitle="Gatilho, condição e ação: avise no DevHub ou envie um webhook para Slack, Discord ou qualquer URL."
      action={
        !creating && (
          <button type="button" className={primaryButton} onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> Nova automação
          </button>
        )
      }
    >
      {creating && (
        <CreateForm
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            state.reload()
          }}
        />
      )}
      <Loadable state={state} what="as automações">
        {(list) =>
          list.length === 0 ? (
            <Panel className="p-6">
              <h2 className="text-headline">Nenhuma automação</h2>
              <p className="mt-1 text-secondary">
                Exemplo: quando um monitor cair, avise um canal do Slack. Cada entrega tem até 3
                tentativas e fica no histórico.
              </p>
            </Panel>
          ) : (
            <Panel label="Automações">
              <ul>
                {list.map((a) => (
                  <AutomationRow key={a.id} a={a} onChange={state.reload} />
                ))}
              </ul>
            </Panel>
          )
        }
      </Loadable>
    </PageShell>
  )
}
