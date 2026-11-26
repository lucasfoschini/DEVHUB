import { ConflictException, Controller, Get, Injectable, Req, UseGuards } from '@nestjs/common'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { GithubAuthError, GithubService } from '../integrations/github.service.js'
import { PrismaService } from '../prisma.service.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'

const REPOS = 10
const PER_REPO = 5
const CACHE_MS = 60_000

interface GhRun {
  id: number
  name: string | null
  display_title: string
  head_branch: string | null
  head_sha: string
  event: string
  status: string
  conclusion: string | null
  html_url: string
  created_at: string
  updated_at: string
}
interface GhDeployment {
  id: number
  environment: string
  ref: string
  sha: string
  created_at: string
}
interface GhStatus {
  state: string
  created_at: string
}

export interface Pipeline {
  repository: { id: string; fullName: string }
  runs: {
    id: number
    workflow: string
    title: string
    branch: string | null
    sha: string
    event: string
    status: string
    conclusion: string | null
    url: string
    createdAt: string
    updatedAt: string
  }[]
  deployments: {
    id: number
    environment: string
    ref: string
    sha: string
    createdAt: string
    state: string | null
  }[]
  /** Set when GitHub refused this repository (no access, Actions disabled…). */
  error: number | null
}

/** Deploy Center (Phase 4), read-only from GitHub: Actions workflow runs and Deployments of
 *  the imported repositories. Nothing is triggered; nothing is inferred. Cached 60 s per
 *  workspace so page refreshes do not spend the user's GitHub rate limit. */
@Injectable()
export class DeploymentsService {
  private cache = new Map<string, { at: number; value: Pipeline[] }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
  ) {}

  async list(workspaceId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: 'github' } },
      select: { status: true },
    })
    if (!integration) return { connected: false, pipelines: [] }
    const hit = this.cache.get(workspaceId)
    if (hit && Date.now() - hit.at < CACHE_MS) return { connected: true, pipelines: hit.value }

    const repos = await this.prisma.repository.findMany({
      where: { workspaceId, provider: 'github', archived: false },
      orderBy: { pushedAt: { sort: 'desc', nulls: 'last' } },
      take: REPOS,
      select: { id: true, fullName: true },
    })
    try {
      const pipelines = await Promise.all(repos.map((r) => this.pipeline(workspaceId, r)))
      this.cache.set(workspaceId, { at: Date.now(), value: pipelines })
      return { connected: true, pipelines }
    } catch (e) {
      if (e instanceof GithubAuthError) {
        throw new ConflictException({ code: 'github_reconnect', message: 'Reconnect GitHub' })
      }
      throw e
    }
  }

  private async pipeline(
    workspaceId: string,
    repository: { id: string; fullName: string },
  ): Promise<Pipeline> {
    const base = `/repos/${repository.fullName}`
    const [runsRes, depRes] = await Promise.all([
      this.github.get(workspaceId, `${base}/actions/runs?per_page=${PER_REPO}`),
      this.github.get(workspaceId, `${base}/deployments?per_page=${PER_REPO}`),
    ])
    if (!runsRes.ok && !depRes.ok) {
      return { repository, runs: [], deployments: [], error: runsRes.status }
    }
    const runs = runsRes.ok
      ? ((await runsRes.json()) as { workflow_runs: GhRun[] }).workflow_runs
      : []
    const deps = depRes.ok ? ((await depRes.json()) as GhDeployment[]) : []
    const states = await Promise.all(
      deps.map(async (d) => {
        const res = await this.github.get(
          workspaceId,
          `${base}/deployments/${d.id}/statuses?per_page=1`,
        )
        return res.ok ? (((await res.json()) as GhStatus[])[0]?.state ?? null) : null
      }),
    )
    return {
      repository,
      error: null,
      runs: runs.map((r) => ({
        id: r.id,
        workflow: r.name ?? 'workflow',
        title: r.display_title,
        branch: r.head_branch,
        sha: r.head_sha.slice(0, 7),
        event: r.event,
        status: r.status,
        conclusion: r.conclusion,
        url: r.html_url,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      deployments: deps.map((d, i) => ({
        id: d.id,
        environment: d.environment,
        ref: d.ref,
        sha: d.sha.slice(0, 7),
        createdAt: d.created_at,
        state: states[i] ?? null,
      })),
    }
  }
}

@Controller('deployments')
@UseGuards(SessionGuard)
export class DeploymentsController {
  constructor(
    private readonly deployments: DeploymentsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.deployments.list((await this.workspaces.personal(req.auth.user.id)).id)
  }
}
