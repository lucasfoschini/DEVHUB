import { useEffect, useId, useState } from 'react'
import { Laptop } from 'lucide-react'
import { secondaryButton } from '../components/formStyles'
import { formatDate, rowButton, useApi } from '../components/page-utils'
import {
  desktop,
  type AgentStatus,
  type Container,
  type GitStatus,
  type Tool,
} from '../desktop/bridge'
import { request } from '../session'

/** Local Agent (Phase 5, ADR 0007): paired desktops and the typed actions they answer. */

const AGENT_ACTIONS = ['git.status', 'docker.listContainers', 'tools.list'] as const
type AgentAction = (typeof AGENT_ACTIONS)[number]

const ACTION_LABEL: Record<AgentAction, string> = {
  'git.status': 'Status do Git das pastas autorizadas',
  'docker.listContainers': 'Listar containers Docker',
  'tools.list': 'Ferramentas instaladas',
}

export interface Device {
  id: string
  name: string
  platform: string
  capabilities: AgentAction[]
  folders: { path: string; name: string }[]
  lastSeenAt: string | null
  online: boolean
}

function Presence({ device }: { device: Device }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-footnote text-secondary">
      <span
        aria-hidden
        className={`text-caption ${device.online ? 'text-success' : 'text-neutral'}`}
      >
        ●
      </span>
      {device.online ? 'Online' : `Visto ${formatDate(device.lastSeenAt)}`}
    </span>
  )
}

function DeviceRow(props: { device: Device; local: AgentStatus | null; onChange: () => void }) {
  const { device } = props
  const id = useId()
  const [busy, setBusy] = useState(false)
  const isThis = props.local?.deviceId === device.id

  const toggle = async (action: AgentAction, on: boolean) => {
    setBusy(true)
    const capabilities = on
      ? [...device.capabilities, action]
      : device.capabilities.filter((c) => c !== action)
    await request('PATCH', `/api/devices/${device.id}`, { capabilities })
    setBusy(false)
    props.onChange()
  }

  const revoke = async () => {
    setBusy(true)
    const res = await request('DELETE', `/api/devices/${device.id}`)
    if (res.ok && isThis) await desktop?.invoke('agent_unpair', {})
    setBusy(false)
    props.onChange()
  }

  return (
    <li className="border-t border-subtle py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 text-body">
          {device.name}
          <span className="text-secondary">
            {' '}
            · {device.platform}
            {isThis && ' · este computador'}
          </span>
        </span>
        <Presence device={device} />
        <button type="button" className={rowButton} disabled={busy} onClick={revoke}>
          Revogar
        </button>
      </div>
      <fieldset className="mt-1.5" aria-describedby={id}>
        <legend id={id} className="sr-only">
          Ações permitidas em {device.name}
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {AGENT_ACTIONS.map((a) => (
            <label key={a} className="inline-flex items-center gap-1.5 text-footnote">
              <input
                type="checkbox"
                checked={device.capabilities.includes(a)}
                disabled={busy}
                onChange={(e) => void toggle(a, e.target.checked)}
              />
              {ACTION_LABEL[a]}
            </label>
          ))}
        </div>
      </fieldset>
    </li>
  )
}

/** Settings: pair this desktop, choose what each device may do, revoke. */
export function DeviceSettings() {
  const devices = useApi<Device[]>('/api/devices')
  const [local, setLocal] = useState<AgentStatus | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [pairing, setPairing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void desktop?.invoke('agent_status', {}).then(setLocal)
  }, [attempt])

  const refresh = () => {
    devices.reload()
    setAttempt((n) => n + 1)
  }

  const pair = async () => {
    setPairing(true)
    setError(null)
    const res = await request<{ code: string }>('POST', '/api/devices/pairings')
    if (!res.ok) {
      setError(`Não foi possível criar o código (HTTP ${res.status}).`)
    } else {
      await desktop!
        .invoke('agent_pair', { code: res.data.code })
        .catch((e: unknown) => setError(String(e)))
    }
    setPairing(false)
    refresh()
  }

  // A device revoked elsewhere still has a local secret until the agent's next token refresh.
  const pairedHere = local?.paired && devices.data?.some((d) => d.id === local.deviceId)

  return (
    <>
      {devices.data === null ? (
        <p className="text-footnote text-secondary">Carregando…</p>
      ) : devices.data.length === 0 ? (
        <p className="text-footnote text-secondary">Nenhum computador pareado.</p>
      ) : (
        <ul>
          {devices.data.map((d) => (
            <DeviceRow key={d.id} device={d} local={local} onChange={refresh} />
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-subtle pt-3">
        {desktop ? (
          !pairedHere && (
            <button type="button" className={secondaryButton} disabled={pairing} onClick={pair}>
              <Laptop size={14} aria-hidden /> {pairing ? 'Pareando…' : 'Parear este computador'}
            </button>
          )
        ) : (
          <p className="text-footnote text-secondary">
            Para parear um computador, abra Configurações no app desktop do DevHub nele.
          </p>
        )}
        {error && (
          <p role="alert" className="text-footnote text-error">
            {error}
          </p>
        )}
      </div>
    </>
  )
}

interface Job {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'expired'
  result: unknown
  error: string | null
}

const POLL_MS = 1000

function JobResult({ action, job }: { action: AgentAction; job: Job }) {
  if (job.status === 'queued' || job.status === 'running') {
    return <p className="text-footnote text-secondary">Aguardando o computador…</p>
  }
  if (job.status !== 'succeeded') {
    return (
      <p role="alert" className="text-footnote text-error">
        {job.status === 'expired' ? 'O computador não respondeu em 60 s.' : job.error}
      </p>
    )
  }
  if (action === 'git.status') {
    const s = job.result as GitStatus
    return (
      <p className="font-mono text-footnote">
        {s.isRepo
          ? [
              s.branch ?? 'HEAD destacado',
              `${s.changed} alterados`,
              `${s.untracked} novos`,
              s.ahead ? `${s.ahead} à frente` : null,
              s.behind ? `${s.behind} atrás` : null,
              s.lastCommit?.subject,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Não é um repositório Git'}
      </p>
    )
  }
  const rows =
    action === 'docker.listContainers'
      ? (job.result as Container[]).map((c) => [c.id, c.name, `${c.image} · ${c.status}`])
      : (job.result as Tool[]).map((t) => [t.id, t.label, t.version ?? 'não instalado'])
  return rows.length === 0 ? (
    <p className="text-footnote text-secondary">Nada encontrado.</p>
  ) : (
    <ul className="font-mono text-footnote">
      {rows.map(([key, name, detail]) => (
        <li key={key}>
          {name} <span className="text-secondary">{detail}</span>
        </li>
      ))}
    </ul>
  )
}

function ActionButton(props: {
  device: Device
  action: AgentAction
  params?: { path: string }
  label: string
}) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return
    const t = setTimeout(() => {
      void request<Job>('GET', `/api/devices/${props.device.id}/jobs/${job.id}`).then((res) =>
        res.ok ? setJob(res.data) : setError(`HTTP ${res.status}`),
      )
    }, POLL_MS)
    return () => clearTimeout(t)
  }, [job, props.device.id])

  const run = async () => {
    setError(null)
    const res = await request<Job>('POST', `/api/devices/${props.device.id}/jobs`, {
      action: props.action,
      params: props.params ?? {},
    })
    if (res.ok) setJob({ ...res.data, result: null, error: null })
    else setError(res.status === 409 ? 'Ação desativada ou fila cheia.' : `HTTP ${res.status}`)
  }

  const pending = job?.status === 'queued' || job?.status === 'running'
  return (
    <div className="py-1">
      <button type="button" className={rowButton} disabled={pending} onClick={run}>
        {props.label}
      </button>
      <div aria-live="polite" className="pl-2">
        {error && (
          <p role="alert" className="text-footnote text-error">
            {error}
          </p>
        )}
        {job && <JobResult action={props.action} job={job} />}
      </div>
    </div>
  )
}

/** Infrastructure: ask a paired computer for its state from any browser. */
export function RemoteDevices() {
  const devices = useApi<Device[]>('/api/devices')
  if (!devices.data || devices.data.length === 0) return null
  return (
    <section
      aria-labelledby="agents-title"
      className="mt-6 overflow-hidden rounded-surface border border-subtle bg-surface"
    >
      <div className="flex items-center justify-between gap-3 p-5 pb-3">
        <h2 id="agents-title" className="flex items-center gap-2 text-headline">
          <Laptop size={18} aria-hidden /> Computadores pareados
        </h2>
        <button type="button" className={rowButton} onClick={devices.reload}>
          Atualizar
        </button>
      </div>
      <ul>
        {devices.data.map((d) => (
          <li key={d.id} className="border-t border-subtle px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-body font-medium">{d.name}</span>
              <Presence device={d} />
            </div>
            {d.capabilities.includes('docker.listContainers') && (
              <ActionButton device={d} action="docker.listContainers" label="Containers Docker" />
            )}
            {d.capabilities.includes('tools.list') && (
              <ActionButton device={d} action="tools.list" label="Ferramentas instaladas" />
            )}
            {d.capabilities.includes('git.status') &&
              d.folders.map((f) => (
                <ActionButton
                  key={f.path}
                  device={d}
                  action="git.status"
                  params={{ path: f.path }}
                  label={`Git status: ${f.name}`}
                />
              ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
