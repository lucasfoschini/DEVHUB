import { request } from '../session'

export interface Repository {
  id: string
  fullName: string
  description: string
  private: boolean
  archived: boolean
  defaultBranch: string
  htmlUrl: string
  language: string | null
  pushedAt: string | null
  lastSyncAt: string
  projects?: { project: { id: string; name: string } }[]
}

export interface AvailableRepo {
  externalId: string
  fullName: string
  private: boolean
  archived: boolean
  pushedAt: string | null
  importedId: string | null
}

/** API 409 with code github_reconnect: no connection, or GitHub rejected the token. */
export function repoError(status: number, code?: string) {
  if (code === 'github_reconnect') return 'Conecte (ou reconecte) o GitHub para continuar.'
  if (code === 'github_error') return 'O GitHub respondeu com erro. Tente de novo em instantes.'
  if (status === 404) return 'Repositório não encontrado ou sem acesso.'
  return 'Não foi possível concluir. Tente de novo.'
}

export const listRepositories = () => request<Repository[]>('GET', '/api/repositories')
export const listAvailable = (page: number) =>
  request<{ items: AvailableRepo[]; nextPage: number | null; code?: string }>(
    'GET',
    `/api/github/repos?page=${page}`,
  )
export const importRepository = (externalId: string) =>
  request<Repository & { code?: string }>('POST', '/api/repositories', { externalId })
export const removeRepository = (id: string) => request('DELETE', `/api/repositories/${id}`)
export const syncRepository = (id: string) =>
  request<Repository>('POST', `/api/repositories/${id}/sync`)
export const projectRepositories = (projectId: string) =>
  request<Repository[]>('GET', `/api/projects/${projectId}/repositories`)
export const linkRepository = (projectId: string, repoId: string) =>
  request('PUT', `/api/projects/${projectId}/repositories/${repoId}`)
export const unlinkRepository = (projectId: string, repoId: string) =>
  request('DELETE', `/api/projects/${projectId}/repositories/${repoId}`)
