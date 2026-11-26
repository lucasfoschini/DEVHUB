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
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'

const MAX_PROMPTS = 500

const fields = {
  title: z.string().trim().min(1).max(120),
  body: z.string().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(30)).max(10),
  projectId: z.uuid().nullable(),
}
export const createPrompt = z.object({
  title: fields.title,
  body: fields.body,
  tags: fields.tags.optional(),
  projectId: fields.projectId.optional(),
})
export const updatePrompt = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

const isUnique = (e: unknown) => (e as { code?: string }).code === 'P2002'

/** AI Center prompt library (Phase 6). Prompts are text with {{variables}}; DevHub does not
 *  call any model provider yet, so nothing here claims to run them. */
@Injectable()
export class PromptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(workspaceId: string) {
    return this.prisma.prompt.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: { project: { select: { id: true, name: true } } },
    })
  }

  private async find(workspaceId: string, id: string) {
    const prompt = await this.prisma.prompt.findFirst({ where: { id, workspaceId } })
    if (!prompt) throw new NotFoundException()
    return prompt
  }

  async create(workspaceId: string, actorId: string, data: z.output<typeof createPrompt>) {
    if ((await this.prisma.prompt.count({ where: { workspaceId } })) >= MAX_PROMPTS) {
      throw new UnprocessableEntityException(`Limit of ${MAX_PROMPTS} prompts reached`)
    }
    await assertProject(this.prisma, workspaceId, data.projectId)
    try {
      const prompt = await this.prisma.prompt.create({ data: { ...data, workspaceId } })
      await this.record('prompt.create', workspaceId, actorId, prompt.id)
      return prompt
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('A prompt with this title exists')
      throw e
    }
  }

  async update(
    workspaceId: string,
    actorId: string,
    id: string,
    data: z.output<typeof updatePrompt>,
  ) {
    await this.find(workspaceId, id)
    await assertProject(this.prisma, workspaceId, data.projectId)
    try {
      const prompt = await this.prisma.prompt.update({ where: { id }, data })
      await this.record('prompt.update', workspaceId, actorId, id)
      return prompt
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('A prompt with this title exists')
      throw e
    }
  }

  async remove(workspaceId: string, actorId: string, id: string) {
    await this.find(workspaceId, id)
    await this.prisma.prompt.delete({ where: { id } })
    await this.record('prompt.delete', workspaceId, actorId, id)
  }

  private record(action: string, workspaceId: string, actorId: string, id: string) {
    return this.audit.record({ action, workspaceId, actorId, targetType: 'prompt', targetId: id })
  }
}

const id = z.uuid()

@Controller('prompts')
@UseGuards(SessionGuard)
export class PromptsController {
  constructor(
    private readonly prompts: PromptsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.prompts.list(await this.workspaceId(req))
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(createPrompt, body)
    return this.prompts.create(await this.workspaceId(req), req.auth.user.id, data)
  }

  @Patch(':id')
  async update(@Req() req: AuthedRequest, @Param('id') raw: string, @Body() body: unknown) {
    const data = parse(updatePrompt, body)
    const ws = await this.workspaceId(req)
    return this.prompts.update(ws, req.auth.user.id, parse(id, raw), data)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') raw: string) {
    await this.prompts.remove(await this.workspaceId(req), req.auth.user.id, parse(id, raw))
  }
}
