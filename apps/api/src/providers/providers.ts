import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  Put,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { AuditService } from '../audit/audit.service.js'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { ENV_TOKEN } from '../env-token.js'
import type { Env } from '../env.js'
import { decrypt, encrypt } from '../integrations/crypto.js'
import { notify } from '../notifications/notify.js'
import { PrismaService } from '../prisma.service.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'

/** Deploy and database providers connected with an API key the user pastes (Phase 4). DevHub only
 *  calls read endpoints; nothing is deployed, scaled or deleted from here. */
export const PROVIDERS = ['render', 'vercel', 'neon'] as const
export type Provider = (typeof PROVIDERS)[number]

const LABEL: Record<Provider, string> = { render: 'Render', vercel: 'Vercel', neon: 'Neon' }
const TIMEOUT_MS = 10_000
const CACHE_MS = 60_000
const MAX_ITEMS = 10
const PER_ITEM = 3

/** The provider rejected the stored key: the integration is flagged and the user reconnects. */
class ProviderAuthError extends Error {}

const providerParam = z.enum(PROVIDERS)
/** Render service ids (srv-…) and Vercel deployment ids (dpl_…). */
const resourceId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)
const MAX_LINES = 100
const MAX_LINE = 2000
const connectBody = z.object({
  token: z.string().trim().min(8).max(512).regex(/^\S+$/, 'A chave não pode ter espaços'),
})

type Fetcher = <T>(path: string) => Promise<T>

interface RenderService {
  id: string
  name: string
  type: string
  suspended: string
  dashboardUrl: string
  serviceDetails?: { url?: string }
}
interface RenderDeploy {
  id: string
  status: string
  commit?: { id?: string; message?: string }
  createdAt: string
  finishedAt: string | null
}
interface VercelDeployment {
  uid: string
  name: string
  url: string
  state?: string
  readyState?: string
  target: string | null
  created: number
  inspectorUrl: string | null
  meta?: { githubCommitRef?: string; githubCommitSha?: string; githubCommitMessage?: string }
}
interface NeonProject {
  id: string
  name: string
  region_id: string
  pg_version: number
  updated_at: string
}
interface NeonBranch {
  id: string
  name: string
  current_state: string
  default?: boolean
  primary?: boolean
  logical_size?: number
  updated_at: string
}

interface RenderLog {
  id: string
  message: string
  timestamp: string
  labels?: { name: string; value: string }[]
}
interface RenderSeries {
  labels?: { field: string; value: string }[]
  unit?: string
  values?: { timestamp: string; value: number }[]
}
interface VercelEvent {
  type: string
  created: number
  id?: string
  serial?: string
  text?: string
  level?: string
  payload?: { id?: string; text?: string }
}

/** Detail reads for one resource, in DevHub's shape. Text is capped per line. */
const details = {
  /** The last lines of a Render service. The service lookup proves the key can see it and gives
   *  the workspace id (ownerId) the logs endpoint requires. */
  async renderLogs(get: Fetcher, id: string) {
    const service = await get<{ id: string; ownerId: string }>(
      `/v1/services/${encodeURIComponent(id)}`,
    )
    const q = new URLSearchParams({
      ownerId: service.ownerId,
      resource: service.id,
      direction: 'backward',
      limit: String(MAX_LINES),
    })
    const { logs } = await get<{ logs: RenderLog[] }>(`/v1/logs?${q}`)
    const label = (l: RenderLog, name: string) =>
      l.labels?.find((x) => x.name === name)?.value ?? null
    return {
      lines: logs
        .map((l) => ({
          id: l.id,
          at: l.timestamp,
          level: label(l, 'level'),
          source: label(l, 'type'),
          text: l.message.slice(0, MAX_LINE),
        }))
        .sort((a, b) => a.at.localeCompare(b.at)),
    }
  },

  /** CPU, memory and HTTP requests over the last hour in 5-minute steps, unit as Render sends it. */
  async renderMetrics(get: Fetcher, id: string) {
    const end = new Date()
    const q = new URLSearchParams({
      resource: id,
      startTime: new Date(end.getTime() - 3_600_000).toISOString(),
      endTime: end.toISOString(),
      resolutionSeconds: '300',
    })
    const metric = async (name: 'cpu' | 'memory' | 'http-requests') =>
      (await get<RenderSeries[]>(`/v1/metrics/${name}?${q}`)).map((s) => ({
        labels: Object.fromEntries((s.labels ?? []).map((l) => [l.field, l.value])),
        unit: s.unit ?? null,
        values: (s.values ?? []).map((v) => ({ at: v.timestamp, value: v.value })),
      }))
    const [cpu, memory, requests] = await Promise.all([
      metric('cpu'),
      metric('memory'),
      metric('http-requests'),
    ])
    return { cpu, memory, requests }
  },

  /** Build output of a Vercel deployment, oldest first. follow=0 keeps it a JSON reply. */
  async vercelEvents(get: Fetcher, id: string) {
    const events = await get<VercelEvent[]>(
      `/v3/deployments/${encodeURIComponent(id)}/events?builds=1&direction=backward&follow=0&limit=${MAX_LINES}`,
    )
    return {
      lines: events
        .map((e, i) => ({
          id: e.id ?? e.payload?.id ?? e.serial ?? String(i),
          at: new Date(e.created).toISOString(),
          level: e.level ?? (e.type === 'stderr' || e.type === 'fatal' ? 'error' : null),
          source: e.type,
          text: (e.text ?? e.payload?.text ?? '').slice(0, MAX_LINE),
        }))
        .filter((l) => l.text)
        .sort((a, b) => a.at.localeCompare(b.at)),
    }
  },
}
type Detail = keyof typeof details
const DETAIL_PROVIDER: Record<Detail, Provider> = {
  renderLogs: 'render',
  renderMetrics: 'render',
  vercelEvents: 'vercel',
}

/** Who the key belongs to, asked once at connect time; a failure means the key is not valid. */
async function whoami(provider: Provider, get: Fetcher) {
  if (provider === 'render') {
    const owners =
      await get<{ owner: { id: string; name: string; email?: string } }[]>('/v1/owners?limit=1')
    const o = owners[0]?.owner
    if (!o) throw new ProviderAuthError()
    return { id: o.id, login: o.email ?? o.name }
  }
  if (provider === 'vercel') {
    const { user } = await get<{ user: { id: string; username: string } }>('/v2/user')
    return { id: user.id, login: user.username }
  }
  const me = await get<{ id: string; email?: string; login?: string }>('/api/v2/users/me')
  return { id: me.id, login: me.email ?? me.login ?? me.id }
}

/** The provider's resources in DevHub's shape. Each list is capped so one page view stays
 *  within the providers' rate limits. */
async function resources(provider: Provider, get: Fetcher) {
  if (provider === 'render') {
    const rows = await get<{ service: RenderService }[]>(`/v1/services?limit=${MAX_ITEMS}`)
    const services = await Promise.all(
      rows.map(async ({ service: s }) => {
        const deploys = await get<{ deploy: RenderDeploy }[]>(
          `/v1/services/${encodeURIComponent(s.id)}/deploys?limit=${PER_ITEM}`,
        )
        return {
          id: s.id,
          name: s.name,
          type: s.type,
          url: s.serviceDetails?.url ?? null,
          dashboardUrl: s.dashboardUrl,
          suspended: s.suspended === 'suspended',
          deploys: deploys.map(({ deploy: d }) => ({
            id: d.id,
            status: d.status,
            sha: d.commit?.id?.slice(0, 7) ?? null,
            message: d.commit?.message?.split('\n')[0] ?? null,
            createdAt: d.createdAt,
            finishedAt: d.finishedAt,
          })),
        }
      }),
    )
    return { provider, services }
  }
  if (provider === 'vercel') {
    // shortcut: personal scope only; team-scoped keys need ?teamId=, add when a team uses it.
    const { deployments } = await get<{ deployments: VercelDeployment[] }>(
      `/v6/deployments?limit=${MAX_ITEMS * 2}`,
    )
    return {
      provider,
      deployments: deployments.map((d) => ({
        id: d.uid,
        project: d.name,
        url: `https://${d.url}`,
        state: d.readyState ?? d.state ?? 'UNKNOWN',
        target: d.target,
        ref: d.meta?.githubCommitRef ?? null,
        sha: d.meta?.githubCommitSha?.slice(0, 7) ?? null,
        message: d.meta?.githubCommitMessage?.split('\n')[0] ?? null,
        createdAt: new Date(d.created).toISOString(),
        inspectorUrl: d.inspectorUrl,
      })),
    }
  }
  // Neon lists personal projects without org_id and each organization's only with it.
  const { organizations } = await get<{ organizations: { id: string; name: string }[] }>(
    '/api/v2/users/me/organizations',
  )
  const scopes = [null, ...organizations.slice(0, MAX_ITEMS)]
  const lists = await Promise.all(
    scopes.map(async (org) => {
      const q = org ? `&org_id=${encodeURIComponent(org.id)}` : ''
      const { projects } = await get<{ projects: NeonProject[] }>(
        `/api/v2/projects?limit=${MAX_ITEMS}${q}`,
      )
      return projects.map((p) => ({ ...p, org: org?.name ?? null }))
    }),
  )
  const unique = [...new Map(lists.flat().map((p) => [p.id, p])).values()].slice(0, MAX_ITEMS)
  const projects = await Promise.all(
    unique.map(async (p) => {
      const { branches } = await get<{ branches: NeonBranch[] }>(
        `/api/v2/projects/${encodeURIComponent(p.id)}/branches`,
      )
      return {
        id: p.id,
        name: p.name,
        organization: p.org,
        region: p.region_id,
        pgVersion: p.pg_version,
        updatedAt: p.updated_at,
        branches: branches.slice(0, MAX_ITEMS).map((b) => ({
          id: b.id,
          name: b.name,
          state: b.current_state,
          isDefault: Boolean(b.default ?? b.primary),
          logicalSize: b.logical_size ?? null,
          updatedAt: b.updated_at,
        })),
      }
    }),
  )
  return { provider, projects }
}

@Injectable()
export class ProvidersService {
  private cache = new Map<string, { at: number; value: unknown }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV_TOKEN) private readonly env: Env,
  ) {}

  private forget(workspaceId: string, provider: Provider) {
    const prefix = `${workspaceId}:${provider}:`
    for (const k of this.cache.keys()) if (k.startsWith(prefix)) this.cache.delete(k)
  }

  private get key() {
    if (!this.env.encryptionKey) throw new ServiceUnavailableException('ENCRYPTION_KEY is not set')
    return this.env.encryptionKey
  }

  private getter(provider: Provider, token: string): Fetcher {
    return async <T>(path: string) => {
      const res = await fetch(new URL(path, this.env.providerApi[provider]), {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.status === 401 || res.status === 403) throw new ProviderAuthError()
      if (res.status === 404) throw new NotFoundException()
      if (!res.ok) throw new BadGatewayException(`${LABEL[provider]} answered HTTP ${res.status}`)
      return (await res.json()) as T
    }
  }

  async list(workspaceId: string) {
    const rows = await this.prisma.integration.findMany({
      where: { workspaceId, provider: { in: [...PROVIDERS] } },
      select: { provider: true, externalLogin: true, status: true, createdAt: true },
    })
    return PROVIDERS.map((provider) => ({
      provider,
      label: LABEL[provider],
      integration: rows.find((r) => r.provider === provider) ?? null,
    }))
  }

  async connect(workspaceId: string, actorId: string, provider: Provider, token: string) {
    const key = this.key
    let who: { id: string; login: string }
    try {
      who = await whoami(provider, this.getter(provider, token))
    } catch (e) {
      if (e instanceof ProviderAuthError) {
        throw new BadRequestException({
          code: 'invalid_key',
          message: `${LABEL[provider]} recusou a chave`,
        })
      }
      throw e
    }
    const data = {
      externalId: who.id,
      externalLogin: who.login,
      scopes: [],
      encryptedToken: encrypt(token, key),
      status: 'connected' as const,
      connectedById: actorId,
    }
    await this.prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider } },
      create: { ...data, workspaceId, provider },
      update: data,
    })
    this.forget(workspaceId, provider)
    await this.audit.record({
      action: 'integration.connect',
      workspaceId,
      actorId,
      targetType: 'integration',
      targetId: provider,
      metadata: { login: who.login },
    })
    return { provider, externalLogin: who.login }
  }

  /** Forgets the key. Provider API keys cannot be revoked through these APIs, so the screen
   *  tells the user to delete the key in the provider's dashboard. */
  async disconnect(workspaceId: string, actorId: string, provider: Provider) {
    const { count } = await this.prisma.integration.deleteMany({ where: { workspaceId, provider } })
    if (count === 0) throw new NotFoundException()
    this.forget(workspaceId, provider)
    await this.audit.record({
      action: 'integration.disconnect',
      workspaceId,
      actorId,
      targetType: 'integration',
      targetId: provider,
    })
  }

  resources(workspaceId: string, provider: Provider) {
    return this.read(workspaceId, provider, 'resources', (get) => resources(provider, get))
  }

  detail(workspaceId: string, detail: Detail, id: string) {
    const provider = DETAIL_PROVIDER[detail]
    return this.read(workspaceId, provider, `${detail}:${id}`, (get) => details[detail](get, id))
  }

  /** Runs one read with the stored key, cached for a minute per workspace and call. A rejected
   *  key flips the integration to needs_reconnect. */
  private async read(
    workspaceId: string,
    provider: Provider,
    what: string,
    run: (get: Fetcher) => Promise<object>,
  ) {
    const integration = await this.prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider } },
    })
    if (!integration) return { provider, connected: false }
    const reconnect = () =>
      new ConflictException({
        code: 'provider_reconnect',
        message: `Reconecte ${LABEL[provider]}`,
      })
    if (integration.status !== 'connected') throw reconnect()
    const cacheKey = `${workspaceId}:${provider}:${what}`
    const hit = this.cache.get(cacheKey)
    if (hit && Date.now() - hit.at < CACHE_MS) return { connected: true, ...(hit.value as object) }
    try {
      const value = await run(this.getter(provider, decrypt(integration.encryptedToken, this.key)))
      this.cache.set(cacheKey, { at: Date.now(), value })
      return { connected: true, ...value }
    } catch (e) {
      if (!(e instanceof ProviderAuthError)) throw e
      // Only the request that flips the status notifies, so concurrent 401s send one.
      const { count } = await this.prisma.integration.updateMany({
        where: { id: integration.id, status: 'connected' },
        data: { status: 'needs_reconnect' },
      })
      if (count > 0) {
        await notify(this.prisma, {
          data: {
            workspaceId,
            kind: 'integration.needs_reconnect',
            severity: 'warning',
            title: `${LABEL[provider]} desconectado`,
            body: `${LABEL[provider]} recusou a chave salva. Conecte novamente em Configurações.`,
            href: '/settings',
          },
        })
      }
      throw reconnect()
    }
  }
}

@Controller('providers')
@UseGuards(SessionGuard)
export class ProvidersController {
  constructor(
    private readonly providers: ProvidersService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.providers.list(await this.workspaceId(req))
  }

  @Put(':provider')
  async connect(@Req() req: AuthedRequest, @Param('provider') p: string, @Body() body: unknown) {
    const provider = parse(providerParam, p)
    const { token } = parse(connectBody, body)
    return this.providers.connect(await this.workspaceId(req), req.auth.user.id, provider, token)
  }

  @Delete(':provider')
  @HttpCode(204)
  async disconnect(@Req() req: AuthedRequest, @Param('provider') p: string) {
    const provider = parse(providerParam, p)
    await this.providers.disconnect(await this.workspaceId(req), req.auth.user.id, provider)
  }

  @Get('render/services/:id/logs')
  async renderLogs(@Req() req: AuthedRequest, @Param('id') id: string) {
    const workspaceId = await this.workspaceId(req)
    return this.providers.detail(workspaceId, 'renderLogs', parse(resourceId, id))
  }

  @Get('render/services/:id/metrics')
  async renderMetrics(@Req() req: AuthedRequest, @Param('id') id: string) {
    const workspaceId = await this.workspaceId(req)
    return this.providers.detail(workspaceId, 'renderMetrics', parse(resourceId, id))
  }

  @Get('vercel/deployments/:id/events')
  async vercelEvents(@Req() req: AuthedRequest, @Param('id') id: string) {
    const workspaceId = await this.workspaceId(req)
    return this.providers.detail(workspaceId, 'vercelEvents', parse(resourceId, id))
  }

  @Get(':provider/resources')
  async resources(@Req() req: AuthedRequest, @Param('provider') p: string) {
    return this.providers.resources(await this.workspaceId(req), parse(providerParam, p))
  }
}
