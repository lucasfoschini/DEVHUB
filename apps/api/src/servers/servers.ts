import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { AuditService } from '../audit/audit.service.js'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { PrismaService } from '../prisma.service.js'
import { assertProject } from '../projects/assert-project.js'
import { ENVIRONMENTS } from '../secrets/secrets.schema.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'

const MAX_SERVERS = 200

const fields = {
  name: z.string().trim().min(1).max(80),
  // Hostname or IP, optionally with port. Stored as text; DevHub does not connect to it.
  host: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(/^[A-Za-z0-9.:[\]-]+$/, 'Hostname or IP'),
  provider: z.string().trim().max(60),
  environment: z.enum(ENVIRONMENTS),
  notes: z.string().trim().max(2000),
  projectId: z.uuid().nullable(),
}
export const createServer = z.object({
  ...fields,
  provider: fields.provider.optional(),
  notes: fields.notes.optional(),
  projectId: fields.projectId.optional(),
})
export const updateServer = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

const isUnique = (e: unknown) => (e as { code?: string }).code === 'P2002'

/** Infrastructure inventory (Phase 4). Entered by the user; no invented health or metrics.
 *  A server's reachability comes from HTTP monitors on the same project. */
@Injectable()
export class ServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(workspaceId: string) {
    return this.prisma.server.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
      include: { project: { select: { id: true, name: true } } },
    })
  }

  private async find(workspaceId: string, id: string) {
    const server = await this.prisma.server.findFirst({ where: { id, workspaceId } })
    if (!server) throw new NotFoundException()
    return server
  }

  async create(workspaceId: string, actorId: string, data: z.output<typeof createServer>) {
    if ((await this.prisma.server.count({ where: { workspaceId } })) >= MAX_SERVERS) {
      throw new UnprocessableEntityException(`Limit of ${MAX_SERVERS} servers reached`)
    }
    await assertProject(this.prisma, workspaceId, data.projectId)
    try {
      const server = await this.prisma.server.create({ data: { ...data, workspaceId } })
      await this.record('server.create', workspaceId, actorId, server.id, data)
      return server
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('A server with this name exists')
      throw e
    }
  }

  async update(
    workspaceId: string,
    actorId: string,
    id: string,
    data: z.output<typeof updateServer>,
  ) {
    await this.find(workspaceId, id)
    await assertProject(this.prisma, workspaceId, data.projectId)
    try {
      const server = await this.prisma.server.update({ where: { id }, data })
      await this.record('server.update', workspaceId, actorId, id, data)
      return server
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('A server with this name exists')
      throw e
    }
  }

  async remove(workspaceId: string, actorId: string, id: string) {
    await this.find(workspaceId, id)
    await this.prisma.server.delete({ where: { id } })
    await this.record('server.delete', workspaceId, actorId, id, {})
  }

  private record(action: string, workspaceId: string, actorId: string, id: string, data: object) {
    return this.audit.record({
      action,
      workspaceId,
      actorId,
      targetType: 'server',
      targetId: id,
      metadata: { fields: Object.keys(data) },
    })
  }
}

const id = z.uuid()

@Controller('servers')
@UseGuards(SessionGuard)
export class ServersController {
  constructor(
    private readonly servers: ServersService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.servers.list(await this.workspaceId(req))
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(createServer, body)
    return this.servers.create(await this.workspaceId(req), req.auth.user.id, data)
  }

  @Patch(':id')
  async update(@Req() req: AuthedRequest, @Param('id') raw: string, @Body() body: unknown) {
    const data = parse(updateServer, body)
    const ws = await this.workspaceId(req)
    return this.servers.update(ws, req.auth.user.id, parse(id, raw), data)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') raw: string) {
    await this.servers.remove(await this.workspaceId(req), req.auth.user.id, parse(id, raw))
  }
}
