import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { AuditService } from '../audit/audit.service.js'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { PrismaService } from '../prisma.service.js'
import { assertProject } from '../projects/assert-project.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'

const MAX_NOTES = 2000

const fields = {
  title: z.string().trim().min(1).max(160),
  body: z.string().max(100_000),
  pinned: z.boolean(),
  projectId: z.uuid().nullable(),
}
export const createNote = z.object({
  title: fields.title,
  body: fields.body.optional(),
  pinned: fields.pinned.optional(),
  projectId: fields.projectId.optional(),
})
export const updateNote = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  projectId: z.uuid().optional(),
})

/** Knowledge Base (Phase 6): Markdown notes. Bodies are returned only by `get`, not in lists. */
@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(workspaceId: string, q: z.output<typeof listQuery>) {
    const text = q.q ? { contains: q.q, mode: 'insensitive' as const } : undefined
    return this.prisma.note.findMany({
      where: {
        workspaceId,
        projectId: q.projectId,
        ...(text ? { OR: [{ title: text }, { body: text }] } : {}),
      },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        title: true,
        pinned: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
    })
  }

  async get(workspaceId: string, id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, workspaceId },
      include: { project: { select: { id: true, name: true } } },
    })
    if (!note) throw new NotFoundException()
    return note
  }

  async create(workspaceId: string, actorId: string, data: z.output<typeof createNote>) {
    if ((await this.prisma.note.count({ where: { workspaceId } })) >= MAX_NOTES) {
      throw new UnprocessableEntityException(`Limit of ${MAX_NOTES} notes reached`)
    }
    await assertProject(this.prisma, workspaceId, data.projectId)
    const note = await this.prisma.note.create({
      data: { ...data, workspaceId, createdById: actorId },
    })
    await this.record('note.create', workspaceId, actorId, note.id)
    return note
  }

  async update(
    workspaceId: string,
    actorId: string,
    id: string,
    data: z.output<typeof updateNote>,
  ) {
    await this.get(workspaceId, id)
    await assertProject(this.prisma, workspaceId, data.projectId)
    const note = await this.prisma.note.update({ where: { id }, data })
    await this.record('note.update', workspaceId, actorId, id)
    return note
  }

  async remove(workspaceId: string, actorId: string, id: string) {
    await this.get(workspaceId, id)
    await this.prisma.note.delete({ where: { id } })
    await this.record('note.delete', workspaceId, actorId, id)
  }

  private record(action: string, workspaceId: string, actorId: string, id: string) {
    return this.audit.record({ action, workspaceId, actorId, targetType: 'note', targetId: id })
  }
}

const id = z.uuid()

@Controller('notes')
@UseGuards(SessionGuard)
export class NotesController {
  constructor(
    private readonly notes: NotesService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    return this.notes.list(await this.workspaceId(req), parse(listQuery, query))
  }

  @Get(':id')
  async get(@Req() req: AuthedRequest, @Param('id') raw: string) {
    return this.notes.get(await this.workspaceId(req), parse(id, raw))
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(createNote, body)
    return this.notes.create(await this.workspaceId(req), req.auth.user.id, data)
  }

  @Patch(':id')
  async update(@Req() req: AuthedRequest, @Param('id') raw: string, @Body() body: unknown) {
    const data = parse(updateNote, body)
    const ws = await this.workspaceId(req)
    return this.notes.update(ws, req.auth.user.id, parse(id, raw), data)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') raw: string) {
    await this.notes.remove(await this.workspaceId(req), req.auth.user.id, parse(id, raw))
  }
}
