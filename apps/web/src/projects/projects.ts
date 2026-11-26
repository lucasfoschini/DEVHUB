import { request } from '../session'

export const STATUSES = [
  'planning',
  'development',
  'testing',
  'production',
  'maintenance',
  'archived',
] as const
export type ProjectStatus = (typeof STATUSES)[number]

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

/** Label and token colour per status (MASTER_PLAN §7.2). */
export const STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  planning: { label: 'Planejamento', color: 'text-neutral' },
  development: { label: 'Desenvolvimento', color: 'text-info' },
  testing: { label: 'Testes', color: 'text-warning' },
  production: { label: 'Produção', color: 'text-success' },
  maintenance: { label: 'Manutenção', color: 'text-pending' },
  archived: { label: 'Arquivado', color: 'text-offline' },
}

/** Maps API errors to Portuguese messages the user can act on. */
export function errorMessage(status: number) {
  if (status === 409) return 'Já existe um projeto com esse nome.'
  if (status === 400) return 'Confira os campos: o nome é obrigatório e tem até 80 caracteres.'
  if (status === 404) return 'Projeto não encontrado.'
  if (status === 401) return 'Sua sessão expirou. Entre de novo.'
  return 'Não foi possível salvar. Tente de novo.'
}

export const listProjects = (cursor?: string) =>
  request<{ items: Project[]; nextCursor: string | null }>(
    'GET',
    `/api/projects?limit=100${cursor ? `&cursor=${cursor}` : ''}`,
  )

export const getProject = (id: string) => request<Project>('GET', `/api/projects/${id}`)

export const createProject = (body: { name: string; description?: string }) =>
  request<Project>('POST', '/api/projects', body)

export const updateProject = (
  id: string,
  body: Partial<Pick<Project, 'name' | 'description' | 'status'>>,
) => request<Project>('PATCH', `/api/projects/${id}`, body)
