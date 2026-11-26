import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import { z } from 'zod'
import { AuditService } from '../audit/audit.service.js'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { ENV_TOKEN } from '../env-token.js'
import type { Env } from '../env.js'
import { probe } from '../monitors/probe.js'
import { urlProblem } from '../monitors/ssrf.js'
import { NOTIFICATION_KINDS, WEBHOOK_FORMATS, webhookPayload } from '../notifications/notify.js'
import { PrismaService } from '../prisma.service.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'

const MAX_AUTOMATIONS = 50
const TICK_MS = 5_000
const MAX_ATTEMPTS = 3
const TIMEOUT_MS = 5_000
const CONCURRENCY = 5

const url = z
  .url()
  .max(2048)
  .refine((u) => urlProblem(u) === null, 'Use an http(s) URL without credentials')
const fields = {
  name: z.string().trim().min(1).max(80),
  trigger: z.enum(NOTIFICATION_KINDS),
  url,
  format: z.enum(WEBHOOK_FORMATS),
  enabled: z.boolean(),
}
export const createAutomation = z.object({
  ...fields,
  format: fields.format.optional(),
  enabled: fields.enabled.optional(),
})
export const updateAutomation = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

type Claimed = { id: string; payload: string; attempts: number; url: string }

const isUnique = (e: unknown) => (e as { code?: string }).code === 'P2002'

/** Automations (Phase 7): "when <event>, POST a webhook". Runs are queued by notify() and
 *  delivered here with the monitor SSRF guard, 3 attempts with backoff, history kept. */
@Injectable()
export class AutomationsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Automations')
  private timer?: NodeJS.Timeout
  private ticking = false

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

  /** Claims due runs atomically; a retry waits 30 s per previous attempt. */
  async tick() {
    if (this.ticking) return
    this.ticking = true
    try {
      const due = await this.prisma.$queryRaw<Claimed[]>`
        UPDATE automation_run r SET attempts = r.attempts + 1
        FROM automation a
        WHERE a.id = r."automationId" AND r.id IN (
          SELECT id FROM automation_run
          WHERE status = 'pending'
            AND "createdAt" <= now() - make_interval(secs => attempts * 30)
          ORDER BY "createdAt" LIMIT 20 FOR UPDATE SKIP LOCKED
        )
        RETURNING r.id, r.payload, r.attempts, a.url`
      // Bounded concurrency: one slow receiver must not hold back the others.
      const queue = [...due]
      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          for (let r = queue.shift(); r; r = queue.shift()) await this.deliver(r)
        }),
      )
    } catch (e) {
      this.log.error(`Automation tick failed: ${(e as Error).message}`)
    } finally {
      this.ticking = false
    }
  }

  private async deliver(run: Claimed) {
    const result = await probe(run.url, {
      timeoutMs: TIMEOUT_MS,
      allowPrivate: this.env.allowPrivateMonitors,
      body: run.payload,
    })
    const ok = result.ok && (result.statusCode ?? 0) < 300
    const final = ok || run.attempts >= MAX_ATTEMPTS
    await this.prisma.automationRun.update({
      where: { id: run.id },
      data: {
        status: ok ? 'succeeded' : final ? 'failed' : 'pending',
        statusCode: result.statusCode ?? null,
        error: ok ? null : (result.error ?? 'http_status'),
        finishedAt: final ? new Date() : null,
      },
    })
  }

  list(workspaceId: string) {
    return this.prisma.automation.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, createdAt: true },
        },
      },
    })
  }

  private async find(workspaceId: string, id: string) {
    const automation = await this.prisma.automation.findFirst({ where: { id, workspaceId } })
    if (!automation) throw new NotFoundException()
    return automation
  }

  async runs(workspaceId: string, id: string) {
    await this.find(workspaceId, id)
    return this.prisma.automationRun.findMany({
      where: { automationId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        attempts: true,
        statusCode: true,
        error: true,
        createdAt: true,
        finishedAt: true,
      },
    })
  }

  async create(workspaceId: string, actorId: string, data: z.output<typeof createAutomation>) {
    if ((await this.prisma.automation.count({ where: { workspaceId } })) >= MAX_AUTOMATIONS) {
      throw new UnprocessableEntityException(`Limit of ${MAX_AUTOMATIONS} automations reached`)
    }
    try {
      const automation = await this.prisma.automation.create({ data: { ...data, workspaceId } })
      await this.record('automation.create', workspaceId, actorId, automation.id, data)
      return automation
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('An automation with this name exists')
      throw e
    }
  }

  async update(
    workspaceId: string,
    actorId: string,
    id: string,
    data: z.output<typeof updateAutomation>,
  ) {
    await this.find(workspaceId, id)
    try {
      const automation = await this.prisma.automation.update({ where: { id }, data })
      await this.record('automation.update', workspaceId, actorId, id, data)
      return automation
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('An automation with this name exists')
      throw e
    }
  }

  async remove(workspaceId: string, actorId: string, id: string) {
    await this.find(workspaceId, id)
    await this.prisma.automation.delete({ where: { id } })
    await this.record('automation.delete', workspaceId, actorId, id, {})
  }

  /** Delivers a clearly labelled test event now and returns the recorded run. The run starts
   *  claimed (attempts = 1), so the worker leaves it alone; a failure is retried by it later. */
  async test(workspaceId: string, actorId: string, id: string) {
    const automation = await this.find(workspaceId, id)
    const run = await this.prisma.automationRun.create({
      data: {
        automationId: id,
        attempts: 1,
        payload: webhookPayload(automation.format, {
          kind: automation.trigger as (typeof NOTIFICATION_KINDS)[number],
          title: `Teste do DevHub: ${automation.name}`,
          body: 'Evento de teste disparado manualmente.',
          severity: 'info',
        }),
      },
    })
    await this.record('automation.test', workspaceId, actorId, id, {})
    await this.deliver({ id: run.id, payload: run.payload, attempts: 1, url: automation.url })
    return this.prisma.automationRun.findUniqueOrThrow({
      where: { id: run.id },
      select: { id: true, status: true, statusCode: true, error: true, createdAt: true },
    })
  }

  private record(action: string, workspaceId: string, actorId: string, id: string, data: object) {
    return this.audit.record({
      action,
      workspaceId,
      actorId,
      targetType: 'automation',
      targetId: id,
      metadata: { fields: Object.keys(data) },
    })
  }
}

const id = z.uuid()

@Controller('automations')
@UseGuards(SessionGuard)
export class AutomationsController {
  constructor(
    private readonly automations: AutomationsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.automations.list(await this.workspaceId(req))
  }

  @Get(':id/runs')
  async runs(@Req() req: AuthedRequest, @Param('id') raw: string) {
    return this.automations.runs(await this.workspaceId(req), parse(id, raw))
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(createAutomation, body)
    return this.automations.create(await this.workspaceId(req), req.auth.user.id, data)
  }

  @Patch(':id')
  async update(@Req() req: AuthedRequest, @Param('id') raw: string, @Body() body: unknown) {
    const data = parse(updateAutomation, body)
    const ws = await this.workspaceId(req)
    return this.automations.update(ws, req.auth.user.id, parse(id, raw), data)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') raw: string) {
    await this.automations.remove(await this.workspaceId(req), req.auth.user.id, parse(id, raw))
  }

  @Post(':id/test')
  async test(@Req() req: AuthedRequest, @Param('id') raw: string) {
    return this.automations.test(await this.workspaceId(req), req.auth.user.id, parse(id, raw))
  }
}
