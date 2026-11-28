import {
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
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { AuditService } from '../audit/audit.service.js'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { ENV_TOKEN } from '../env-token.js'
import type { Env } from '../env.js'
import type { Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma.service.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import { accessToken, deviceSecret, pairingCode, sha256, verifyToken } from './token.js'

/** Local Agent (Phase 5, ADR 0007): pairing, device tokens and typed jobs the desktop app polls. */

export const AGENT_ACTIONS = ['git.status', 'docker.listContainers', 'tools.list'] as const
export type AgentAction = (typeof AGENT_ACTIONS)[number]

const PAIRING_MS = 10 * 60_000
const JOB_TTL_MS = 60_000
const ONLINE_MS = 30_000
const MAX_QUEUED = 20
const MAX_RESULT_BYTES = 64 * 1024
const MAX_FOLDERS = 50

const id = z.uuid()
const path = z.string().min(1).max(1024)
const actionParams = {
  'git.status': z.object({ path }),
  'docker.listContainers': z.object({}),
  'tools.list': z.object({}),
} satisfies Record<AgentAction, z.ZodType>

const pairBody = z.object({
  code: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^[A-Z2-9]{8}$/)),
  name: z.string().trim().min(1).max(80),
  platform: z.string().trim().min(1).max(40),
})
const tokenBody = z.object({ deviceId: id, secret: z.string().min(32).max(128) })
const heartbeatBody = z.object({
  folders: z
    .array(z.object({ path, name: z.string().max(255) }))
    .max(MAX_FOLDERS)
    .default([]),
})
const updateBody = z.object({ capabilities: z.array(z.enum(AGENT_ACTIONS)).max(10) })
const jobBody = z.object({ action: z.enum(AGENT_ACTIONS), params: z.unknown().default({}) })
const resultBody = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().max(1000).optional(),
})

type AgentRequest = Request & { deviceId: string }

/** Bearer access tokens only; cookies are never read on agent routes. */
@Injectable()
export class AgentGuard implements CanActivate {
  constructor(@Inject(ENV_TOKEN) private readonly env: Env) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AgentRequest>()
    const header = req.headers.authorization ?? ''
    const deviceId = header.startsWith('Bearer ')
      ? verifyToken(this.env.secret, header.slice(7))
      : null
    if (!deviceId) throw new UnauthorizedException()
    req.deviceId = deviceId
    return true
  }
}

const folderList = (json: Prisma.JsonValue) =>
  Array.isArray(json) ? (json as { path: string; name: string }[]) : []

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV_TOKEN) private readonly env: Env,
  ) {}

  // ——— Session side (the user in the web app) ———

  async createPairing(workspaceId: string, actorId: string) {
    await this.prisma.devicePairing.deleteMany({
      where: { workspaceId, expiresAt: { lt: new Date() } },
    })
    const code = pairingCode()
    const expiresAt = new Date(Date.now() + PAIRING_MS)
    await this.prisma.devicePairing.create({
      data: { workspaceId, codeHash: sha256(code), createdById: actorId, expiresAt },
    })
    return { code, expiresAt }
  }

  async list(workspaceId: string) {
    const devices = await this.prisma.device.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        platform: true,
        capabilities: true,
        folders: true,
        lastSeenAt: true,
        createdAt: true,
      },
    })
    const now = Date.now()
    return devices.map((d) => ({
      ...d,
      folders: folderList(d.folders),
      online: d.lastSeenAt !== null && now - d.lastSeenAt.getTime() < ONLINE_MS,
    }))
  }

  private async device(workspaceId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, workspaceId } })
    if (!device) throw new NotFoundException()
    return device
  }

  async update(workspaceId: string, actorId: string, deviceId: string, capabilities: string[]) {
    await this.device(workspaceId, deviceId)
    const unique = [...new Set(capabilities)]
    await this.prisma.device.update({ where: { id: deviceId }, data: { capabilities: unique } })
    await this.audit.record({
      action: 'device.update',
      workspaceId,
      actorId,
      targetType: 'device',
      targetId: deviceId,
      metadata: { capabilities: unique },
    })
  }

  /** Deleting the row revokes the secret and every token at the next request. */
  async revoke(workspaceId: string, actorId: string, deviceId: string) {
    const { count } = await this.prisma.device.deleteMany({ where: { id: deviceId, workspaceId } })
    if (count === 0) throw new NotFoundException()
    await this.audit.record({
      action: 'device.revoke',
      workspaceId,
      actorId,
      targetType: 'device',
      targetId: deviceId,
    })
  }

  async createJob(
    workspaceId: string,
    actorId: string,
    deviceId: string,
    action: AgentAction,
    raw: unknown,
  ) {
    const device = await this.device(workspaceId, deviceId)
    if (!device.capabilities.includes(action)) {
      throw new ConflictException({
        code: 'capability_disabled',
        message: 'Ação desativada neste dispositivo',
      })
    }
    const params = parse(actionParams[action], raw)
    if ('path' in params && !folderList(device.folders).some((f) => f.path === params.path)) {
      throw new BadRequestException({
        code: 'folder_not_authorized',
        message: 'Pasta não autorizada no dispositivo',
      })
    }
    const queued = await this.prisma.agentJob.count({
      where: { deviceId, status: 'queued', expiresAt: { gt: new Date() } },
    })
    if (queued >= MAX_QUEUED) {
      throw new ConflictException({ code: 'queue_full', message: 'Fila do dispositivo cheia' })
    }
    const job = await this.prisma.agentJob.create({
      data: {
        workspaceId,
        deviceId,
        action,
        params,
        requestedById: actorId,
        expiresAt: new Date(Date.now() + JOB_TTL_MS),
      },
      select: { id: true, status: true, expiresAt: true },
    })
    await this.audit.record({
      action: 'agent.job',
      workspaceId,
      actorId,
      targetType: 'device',
      targetId: deviceId,
      metadata: { job: job.id, action },
    })
    return job
  }

  async job(workspaceId: string, deviceId: string, jobId: string) {
    // Jobs past their deadline that no agent finished are reported as expired.
    await this.prisma.agentJob.updateMany({
      where: {
        id: jobId,
        workspaceId,
        status: { in: ['queued', 'running'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired', finishedAt: new Date() },
    })
    const job = await this.prisma.agentJob.findFirst({
      where: { id: jobId, deviceId, workspaceId },
      select: {
        id: true,
        action: true,
        params: true,
        status: true,
        result: true,
        error: true,
        createdAt: true,
        finishedAt: true,
      },
    })
    if (!job) throw new NotFoundException()
    return job
  }

  // ——— Agent side (the desktop app) ———

  async pair(code: string, name: string, platform: string) {
    const now = new Date()
    const pairing = await this.prisma.devicePairing.findUnique({
      where: { codeHash: sha256(code) },
    })
    const invalid = () =>
      new BadRequestException({ code: 'invalid_code', message: 'Código inválido ou expirado' })
    if (!pairing || pairing.usedAt || pairing.expiresAt < now) throw invalid()
    // Single use: only the request that sets usedAt goes on.
    const { count } = await this.prisma.devicePairing.updateMany({
      where: { id: pairing.id, usedAt: null },
      data: { usedAt: now },
    })
    if (count === 0) throw invalid()
    const secret = deviceSecret()
    const device = await this.prisma.device.create({
      data: {
        workspaceId: pairing.workspaceId,
        name,
        platform,
        secretHash: sha256(secret),
        capabilities: [...AGENT_ACTIONS],
        pairedById: pairing.createdById,
        lastSeenAt: now,
      },
      select: { id: true },
    })
    await this.audit.record({
      action: 'device.pair',
      workspaceId: pairing.workspaceId,
      actorId: pairing.createdById,
      targetType: 'device',
      targetId: device.id,
      metadata: { name, platform },
    })
    return { deviceId: device.id, secret }
  }

  async token(deviceId: string, secret: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { secretHash: true },
    })
    // Hashes compared as hex of equal length; a timing difference reveals nothing usable.
    if (!device || device.secretHash !== sha256(secret)) throw new UnauthorizedException()
    await this.touch(deviceId)
    return accessToken(this.env.secret, deviceId)
  }

  /** The device behind a verified token; gone means revoked. */
  private async seen(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, capabilities: true },
    })
    if (!device) throw new UnauthorizedException()
    await this.touch(deviceId)
    return device
  }

  private touch(deviceId: string) {
    return this.prisma.device.updateMany({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    })
  }

  async heartbeat(deviceId: string, folders: { path: string; name: string }[]) {
    const device = await this.seen(deviceId)
    await this.prisma.device.update({ where: { id: deviceId }, data: { folders } })
    return { capabilities: device.capabilities }
  }

  /** Claims the oldest live job whose action is still enabled. */
  async next(deviceId: string) {
    const device = await this.seen(deviceId)
    for (;;) {
      const job = await this.prisma.agentJob.findFirst({
        where: {
          deviceId,
          status: 'queued',
          expiresAt: { gt: new Date() },
          action: { in: device.capabilities },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, action: true, params: true },
      })
      if (!job) return null
      const { count } = await this.prisma.agentJob.updateMany({
        where: { id: job.id, status: 'queued' },
        data: { status: 'running' },
      })
      if (count > 0) return { ...job, capabilities: device.capabilities }
    }
  }

  async finish(
    deviceId: string,
    jobId: string,
    body: { ok: boolean; result?: unknown; error?: string },
  ) {
    await this.seen(deviceId)
    if (body.ok && JSON.stringify(body.result ?? null).length > MAX_RESULT_BYTES) {
      body = { ok: false, error: 'Resultado maior que 64 KB' }
    }
    // One result per job, only from the device that claimed it, only before the deadline.
    const { count } = await this.prisma.agentJob.updateMany({
      where: { id: jobId, deviceId, status: 'running', expiresAt: { gt: new Date() } },
      data: body.ok
        ? { status: 'succeeded', result: (body.result ?? null) as Prisma.InputJsonValue }
        : { status: 'failed', error: body.error ?? 'Falhou' },
    })
    if (count === 0) throw new ConflictException({ code: 'job_closed' })
    await this.prisma.agentJob.update({ where: { id: jobId }, data: { finishedAt: new Date() } })
  }
}

@Controller('devices')
@UseGuards(SessionGuard)
export class DevicesController {
  constructor(
    private readonly agent: AgentService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.agent.list(await this.workspaceId(req))
  }

  @Post('pairings')
  async pairing(@Req() req: AuthedRequest) {
    return this.agent.createPairing(await this.workspaceId(req), req.auth.user.id)
  }

  @Patch(':id')
  @HttpCode(204)
  async update(@Req() req: AuthedRequest, @Param('id') deviceId: string, @Body() body: unknown) {
    const { capabilities } = parse(updateBody, body)
    const ws = await this.workspaceId(req)
    await this.agent.update(ws, req.auth.user.id, parse(id, deviceId), capabilities)
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@Req() req: AuthedRequest, @Param('id') deviceId: string) {
    await this.agent.revoke(await this.workspaceId(req), req.auth.user.id, parse(id, deviceId))
  }

  @Post(':id/jobs')
  async createJob(@Req() req: AuthedRequest, @Param('id') deviceId: string, @Body() body: unknown) {
    const { action, params } = parse(jobBody, body)
    const ws = await this.workspaceId(req)
    return this.agent.createJob(ws, req.auth.user.id, parse(id, deviceId), action, params)
  }

  @Get(':id/jobs/:job')
  async job(@Req() req: AuthedRequest, @Param('id') deviceId: string, @Param('job') jobId: string) {
    const ws = await this.workspaceId(req)
    return this.agent.job(ws, parse(id, deviceId), parse(id, jobId))
  }
}

@Controller('agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('pair')
  pair(@Body() body: unknown) {
    const { code, name, platform } = parse(pairBody, body)
    return this.agent.pair(code, name, platform)
  }

  @Post('token')
  @HttpCode(200)
  token(@Body() body: unknown) {
    const { deviceId, secret } = parse(tokenBody, body)
    return this.agent.token(deviceId, secret)
  }

  @Post('heartbeat')
  @HttpCode(200)
  @UseGuards(AgentGuard)
  heartbeat(@Req() req: AgentRequest, @Body() body: unknown) {
    return this.agent.heartbeat(req.deviceId, parse(heartbeatBody, body).folders)
  }

  @Get('jobs/next')
  @UseGuards(AgentGuard)
  async next(@Req() req: AgentRequest, @Res({ passthrough: true }) res: Response) {
    const job = await this.agent.next(req.deviceId)
    if (!job) res.status(204)
    return job ?? undefined
  }

  @Post('jobs/:job/result')
  @HttpCode(204)
  @UseGuards(AgentGuard)
  async result(@Req() req: AgentRequest, @Param('job') jobId: string, @Body() body: unknown) {
    await this.agent.finish(req.deviceId, parse(id, jobId), parse(resultBody, body))
  }
}
