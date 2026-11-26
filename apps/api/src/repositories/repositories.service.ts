import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { AuditService } from '../audit/audit.service.js'
import { GithubAuthError, GithubService } from '../integrations/github.service.js'
import { PrismaService } from '../prisma.service.js'

const PROVIDER = 'github'
const PER_PAGE = 50

/** Fields DevHub keeps from GitHub's repository object. */
interface GhRepo {
  id: number
  full_name: string
  description: string | null
  private: boolean
  archived: boolean
  default_branch: string
  html_url: string
  language: string | null
  pushed_at: string | null
}

const snapshot = (r: GhRepo) => ({
  fullName: r.full_name,
  description: r.description ?? '',
  private: r.private,
  archived: r.archived,
  defaultBranch: r.default_branch,
  htmlUrl: r.html_url,
  language: r.language,
  pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
  lastSyncAt: new Date(),
})

/** Read-only use of GitHub: only GET endpoints are ever called. */
@Injectable()
export class RepositoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
    private readonly audit: AuditService,
  ) {}

  /** Repositories the connected account can see, one page at a time, marked when imported. */
  async available(workspaceId: string, page: number) {
    const res = await this.call(() =>
      this.github.get(
        workspaceId,
        `/user/repos?per_page=${PER_PAGE}&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`,
      ),
    )
    const repos = (await res.json()) as GhRepo[]
    const imported = await this.prisma.repository.findMany({
      where: {
        workspaceId,
        provider: PROVIDER,
        externalId: { in: repos.map((r) => String(r.id)) },
      },
      select: { externalId: true, id: true },
    })
    const byExternal = new Map(imported.map((i) => [i.externalId, i.id]))
    return {
      items: repos.map((r) => ({
        externalId: String(r.id),
        fullName: r.full_name,
        private: r.private,
        archived: r.archived,
        pushedAt: r.pushed_at,
        importedId: byExternal.get(String(r.id)) ?? null,
      })),
      // GitHub signals more pages through the Link header.
      nextPage: /rel="next"/.test(res.headers.get('link') ?? '') ? page + 1 : null,
    }
  }

  list(workspaceId: string) {
    return this.prisma.repository.findMany({
      where: { workspaceId },
      orderBy: { fullName: 'asc' },
      include: { projects: { select: { project: { select: { id: true, name: true } } } } },
    })
  }

  /** Imports by GitHub id. Metadata is read from GitHub, so a client cannot forge it, and a
   *  repository the account cannot see is refused (GitHub answers 404). */
  async import(workspaceId: string, actorId: string, externalId: string) {
    const repo = await this.fetchRepo(workspaceId, externalId)
    const saved = await this.prisma.repository.upsert({
      where: {
        workspaceId_provider_externalId: { workspaceId, provider: PROVIDER, externalId },
      },
      create: {
        ...snapshot(repo),
        workspaceId,
        provider: PROVIDER,
        externalId,
        importedById: actorId,
      },
      update: snapshot(repo),
    })
    await this.audit.record({
      action: 'repository.import',
      workspaceId,
      actorId,
      targetType: 'repository',
      targetId: saved.id,
      metadata: { fullName: saved.fullName },
    })
    return saved
  }

  async sync(workspaceId: string, id: string) {
    const existing = await this.get(workspaceId, id)
    const repo = await this.fetchRepo(workspaceId, existing.externalId)
    return this.prisma.repository.update({ where: { id }, data: snapshot(repo) })
  }

  async remove(workspaceId: string, actorId: string, id: string) {
    const existing = await this.get(workspaceId, id)
    await this.prisma.repository.delete({ where: { id } })
    await this.audit.record({
      action: 'repository.remove',
      workspaceId,
      actorId,
      targetType: 'repository',
      targetId: id,
      metadata: { fullName: existing.fullName },
    })
  }

  /** Links require both sides in the caller's workspace; otherwise 404 for either. */
  async link(workspaceId: string, actorId: string, projectId: string, repositoryId: string) {
    await this.assertPair(workspaceId, projectId, repositoryId)
    await this.prisma.projectRepository.upsert({
      where: { projectId_repositoryId: { projectId, repositoryId } },
      create: { projectId, repositoryId },
      update: {},
    })
    await this.audit.record({
      action: 'project.link_repository',
      workspaceId,
      actorId,
      targetType: 'project',
      targetId: projectId,
      metadata: { repositoryId },
    })
  }

  async unlink(workspaceId: string, actorId: string, projectId: string, repositoryId: string) {
    await this.assertPair(workspaceId, projectId, repositoryId)
    await this.prisma.projectRepository.deleteMany({ where: { projectId, repositoryId } })
    await this.audit.record({
      action: 'project.unlink_repository',
      workspaceId,
      actorId,
      targetType: 'project',
      targetId: projectId,
      metadata: { repositoryId },
    })
  }

  forProject(workspaceId: string, projectId: string) {
    return this.prisma.repository.findMany({
      where: { workspaceId, projects: { some: { projectId } } },
      orderBy: { fullName: 'asc' },
    })
  }

  private async get(workspaceId: string, id: string) {
    const repo = await this.prisma.repository.findFirst({ where: { id, workspaceId } })
    if (!repo) throw new NotFoundException()
    return repo
  }

  private async assertPair(workspaceId: string, projectId: string, repositoryId: string) {
    const [project, repo] = await Promise.all([
      this.prisma.project.findFirst({
        where: { id: projectId, workspaceId },
        select: { id: true },
      }),
      this.prisma.repository.findFirst({
        where: { id: repositoryId, workspaceId },
        select: { id: true },
      }),
    ])
    if (!project || !repo) throw new NotFoundException()
  }

  private async fetchRepo(workspaceId: string, externalId: string) {
    const res = await this.call(() => this.github.get(workspaceId, `/repositories/${externalId}`))
    if (res.status === 404) throw new NotFoundException('Repository not accessible')
    return (await res.json()) as GhRepo
  }

  /** Maps a missing or rejected GitHub connection to a 409 the web app can act on. */
  private async call(run: () => Promise<Response>) {
    try {
      const res = await run()
      if (!res.ok && res.status !== 404) {
        throw new ConflictException({ code: 'github_error', status: res.status })
      }
      return res
    } catch (e) {
      if (e instanceof GithubAuthError) {
        throw new ConflictException({ code: 'github_reconnect', message: 'Connect GitHub first' })
      }
      throw e
    }
  }
}
