import { request } from '../session'

export type MonitorState = 'unknown' | 'up' | 'down'

/** Observed figures over the last 24 h. null means "not enough data", never zero. */
export interface Window24h {
  checks: number
  uptime: number | null
  p50: number | null
  p95: number | null
  p99: number | null
}

export interface Monitor {
  id: string
  name: string
  url: string
  intervalSeconds: number
  timeoutMs: number
  enabled: boolean
  state: MonitorState
  lastCheckedAt: string | null
  project: { id: string; name: string } | null
  last24h: Window24h
}

export interface Check {
  id: string
  checkedAt: string
  ok: boolean
  statusCode: number | null
  latencyMs: number | null
  error: string | null
}

export interface Incident {
  id: string
  cause: string
  openedAt: string
  resolvedAt: string | null
}

export interface MonitorDetail extends Monitor {
  recentChecks: Check[]
  incidents: Incident[]
}

export const STATE_META: Record<MonitorState, { label: string; color: string }> = {
  up: { label: 'Operacional', color: 'text-success' },
  down: { label: 'Fora do ar', color: 'text-error' },
  unknown: { label: 'Sem verificação', color: 'text-neutral' },
}

/** Check failure reasons from the API, in Portuguese. */
export const ERROR_LABEL: Record<string, string> = {
  timeout: 'Tempo esgotado',
  dns: 'DNS não resolveu',
  connection_refused: 'Conexão recusada',
  connection_reset: 'Conexão interrompida',
  tls: 'Erro de TLS/certificado',
  http_status: 'Status HTTP de erro',
  blocked_address: 'Endereço bloqueado (rede privada)',
  invalid_url: 'URL inválida',
  unsupported_protocol: 'Protocolo não suportado',
  credentials_in_url: 'URL com credenciais',
  network: 'Erro de rede',
}

export const INTERVALS = [
  { seconds: 60, label: '1 min' },
  { seconds: 300, label: '5 min' },
  { seconds: 900, label: '15 min' },
  { seconds: 3600, label: '1 h' },
]

export function errorMessage(status: number) {
  if (status === 409) return 'Já existe um monitor com esse nome.'
  if (status === 400) return 'Confira os campos: use uma URL http(s) sem usuário e senha.'
  if (status === 422) return 'Limite de monitores atingido ou projeto inválido.'
  if (status === 404) return 'Monitor não encontrado.'
  if (status === 401) return 'Sua sessão expirou. Entre de novo.'
  return 'Não foi possível concluir. Tente de novo.'
}

export const percent = (v: number | null) =>
  v === null ? null : `${(v * 100).toFixed(v === 1 ? 0 : 2).replace('.', ',')}%`
export const ms = (v: number | null) => (v === null ? null : `${v} ms`)

export const listMonitors = () => request<Monitor[]>('GET', '/api/monitors')
export const getMonitor = (id: string) => request<MonitorDetail>('GET', `/api/monitors/${id}`)
export const createMonitor = (body: {
  name: string
  url: string
  intervalSeconds: number
  projectId?: string
}) => request<Monitor>('POST', '/api/monitors', body)
export const updateMonitor = (id: string, body: Partial<Pick<Monitor, 'enabled' | 'name'>>) =>
  request<Monitor>('PATCH', `/api/monitors/${id}`, body)
export const deleteMonitor = (id: string) => request('DELETE', `/api/monitors/${id}`)
export const checkNow = (id: string) => request<Check>('POST', `/api/monitors/${id}/check`)
