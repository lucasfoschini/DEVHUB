import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import type { z } from 'zod'
import { ENV_TOKEN } from '../env-token.js'
import type { Env } from '../env.js'
import { AuditService } from '../audit/audit.service.js'
import { notify } from '../notifications/notify.js'
import { PrismaService } from '../prisma.service.js'
import { MAX_MONITORS, type createMonitor, type updateMonitor } from './monitors.schema.js'
import { probe } from './probe.js'
import { incidentAction, summarize } from './stats.js'

const TICK_MS = 15_000
const BATCH = 20
const CONCURRENCY = 5
const RETENTION_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

type Claimed = { id: string; url: string; timeoutMs: number }

const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === 'P2002'

@Injectable()
export class MonitorsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Monitors')
  private timer?: NodeJS.Timeout
  private ticking = false
  private lastPrune = 0

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV_TOKEN) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS)
  }

  onModuleDestroy() {
    clearInterval(this.timer)
  }

  // ---- Scheduler -------------------------------------------------------------------------

  /** Claims due monitors atomically (FOR UPDATE SKIP LOCKED), so several API instances never
   *  check the same monitor twice, then runs them with bounded concurrency. */
  async tick() {
    if (this.ticking) return
    this.ticking = true
    try {
      const due = await this.prisma.$queryRaw<Claimed[]>`
        UPDATE monitor SET "nextCheckAt" = now() + make_interval(secs => "intervalSeconds")
        WHERE id IN (
          SELECT id FROM monitor WHERE enabled AND "nextCheckAt" <= now()
          ORDER BY "nextCheckAt" LIMIT ${BATCH} FOR UPDATE SKIP LOCKED
        )
        RETURNING id, url, "timeoutMs"`
      const queue = [...due]
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          for (let m = queue.shift(); m; m = queue.shift()) await this.run(m)
        }),
      )
      if (Date.now() - this.lastPrune > 60 * 60 * 1000) await this.prune()
    } catch (e) {
      this.log.error(`Scheduler tick failed: ${(e as Error).message}`)
    } finally {
      this.ticking = false
    }
  }

  private async prune() {
    this.lastPrune = Date.now()
    const before = new Date(Date.now() - RETENTION_DAYS * DAY_MS)
    await this.prisma.monitorCheck.deleteMany({ where: { checkedAt: { lt: before } } })
  }

  /** Runs one check and records it, updating state and incidents in one transaction. */
  private async run(m: Claimed) {
    const result = await probe(m.url, {
      timeoutMs: m.timeoutMs,
      allowPrivate: this.env.allowPrivateMonitors,
    })
    return this.prisma.$transaction(async (tx) => {
      const check = await tx.monitorCheck.create({
        data: {
          monitorId: m.id,
          ok: result.ok,
          statusCode: result.statusCode,
          latencyMs: result.latencyMs,
          error: result.error,
        },
      })
      const monitor = await tx.monitor.update({
        where: { id: m.id },
        data: {
          lastCheckedAt: check.checkedAt,
          state: result.ok ? 'up' : 'down',
          consecutiveFailures: result.ok ? 0 : { increment: 1 },
        },
      })
      const open = await tx.incident.findFirst({ where: { monitorId: m.id, resolvedAt: null } })
      const action = incidentAction(result.ok, open !== null, monitor.consecutiveFailures)
      if (action === 'resolve') {
        await tx.incident.update({ where: { id: open!.id }, data: { resolvedAt: check.checkedAt } })
        await notify(tx, {
          data: {
            workspaceId: monitor.workspaceId,
            kind: 'monitor.recovered',
            severity: 'success',
            title: `${monitor.name} voltou a responder`,
            href: `/observability/${m.id}`,
          },
        })
      } else if (action === 'open') {
        const cause = result.error ?? 'unknown'
        await tx.incident.create({
          data: { workspaceId: monitor.workspaceId, monitorId: m.id, cause },
        })
        await notify(tx, {
          data: {
            workspaceId: monitor.workspaceId,
            kind: 'monitor.down',
            severity: 'critical',
            title: `${monitor.name} está fora do ar`,
            // Machine-readable cause; the web app translates it (ERROR_LABEL).
            body: cause,
            href: `/observability/${m.id}`,
          },
        })
      }
      return check
    })
  }

  // ---- CRUD (always scoped by the session's workspace) -----------------------------------

  async list(workspaceId: string) {
    const monitors = await this.prisma.monitor.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
      include: { project: { select: { id: true, name: true } } },
    })
    const since = new Date(Date.now() - DAY_MS)
    const recent = await this.prisma.monitorCheck.findMany({
      where: { monitorId: { in: monitors.map((m) => m.id) }, checkedAt: { gte: since } },
      select: { monitorId: true, ok: true, latencyMs: true },
    })
    return monitors.map((m) => ({
      ...m,
      last24h: summarize(recent.filter((c) => c.monitorId === m.id)),
    }))
  }

  async get(workspaceId: string, id: string) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id, workspaceId },
      include: { project: { select: { id: true, name: true } } },
    })
    if (!monitor) throw new NotFoundException()
    const since = new Date(Date.now() - DAY_MS)
    const [window, recentChecks, incidents] = await Promise.all([
      this.prisma.monitorCheck.findMany({
        where: { monitorId: id, checkedAt: { gte: since } },
        select: { ok: true, latencyMs: true },
      }),
      this.prisma.monitorCheck.findMany({
        where: { monitorId: id },
        orderBy: { checkedAt: 'desc' },
        take: 50,
      }),
      this.prisma.incident.findMany({
        where: { monitorId: id },
        orderBy: { openedAt: 'desc' },
        take: 20,
      }),
    ])
    return { ...monitor, last24h: summarize(window), recentChecks, incidents }
  }

  async create(workspaceId: string, actorId: string, data: z.output<typeof createMonitor>) {
    const count = await this.prisma.monitor.count({ where: { workspaceId } })
    if (count >= MAX_MONITORS) {
      throw new UnprocessableEntityException(`Limit of ${MAX_MONITORS} monitors reached`)
    }
    await this.assertProject(workspaceId, data.projectId)
    try {
      const monitor = await this.prisma.monitor.create({ data: { ...data, workspaceId } })
      await this.record('monitor.create', workspaceId, actorId, monitor.id, data)
      return monitor
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('A monitor with this name exists')
      throw e
    }
  }

  async update(
    workspaceId: string,
    actorId: string,
    id: string,
    data: z.output<typeof updateMonitor>,
  ) {
    await this.get(workspaceId, id)
    await this.assertProject(workspaceId, data.projectId)
    try {
      const monitor = await this.prisma.monitor.update({
        where: { id },
        // A changed URL or re-enabled monitor is checked on the next tick.
        data: { ...data, ...(data.url || data.enabled ? { nextCheckAt: new Date() } : {}) },
      })
      await this.record('monitor.update', workspaceId, actorId, id, data)
      return monitor
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('A monitor with this name exists')
      throw e
    }
  }

  async remove(workspaceId: string, actorId: string, id: string) {
    await this.get(workspaceId, id)
    await this.prisma.monitor.delete({ where: { id } })
    await this.record('monitor.delete', workspaceId, actorId, id, {})
  }

  /** Manual "check now". Rate-limited by the claim: a monitor checked in the last 10 s is not
   *  re-run, so the button cannot be used to flood a target. */
  async checkNow(workspaceId: string, id: string) {
    await this.get(workspaceId, id)
    const [claimed] = await this.prisma.$queryRaw<Claimed[]>`
      UPDATE monitor SET "nextCheckAt" = now() + make_interval(secs => "intervalSeconds")
      WHERE id = ${id} AND ("lastCheckedAt" IS NULL OR "lastCheckedAt" < now() - interval '10 seconds')
      RETURNING id, url, "timeoutMs"`
    if (!claimed) throw new ConflictException('Checked less than 10 seconds ago')
    return this.run(claimed)
  }

  private async assertProject(workspaceId: string, projectId: string | null | undefined) {
    if (!projectId) return
    const found = await this.prisma.project.findFirst({ where: { id: projectId, workspaceId } })
    // Same answer as a missing project: never link across workspaces.
    if (!found) throw new UnprocessableEntityException('Project not found')
  }

  private record(
    action: string,
    workspaceId: string,
    actorId: string,
    targetId: string,
    changes: object,
  ) {
    return this.audit.record({
      action,
      workspaceId,
      actorId,
      targetType: 'monitor',
      targetId,
      metadata: { fields: Object.keys(changes) },
    })
  }
}
