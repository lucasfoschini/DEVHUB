import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { z } from 'zod'
import { AuditService } from '../audit/audit.service.js'
import { PrismaService } from '../prisma.service.js'
import type { createProject, listProjects, updateProject } from './projects.schema.js'

const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === 'P2002'

/** Every query is scoped by `workspaceId` taken from the session, never from the request. */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(workspaceId: string, q: z.output<typeof listProjects>) {
    const items = await this.prisma.project.findMany({
      where: { workspaceId, status: q.status },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    })
    const more = items.length > q.limit
    if (more) items.pop()
    return { items, nextCursor: more ? items.at(-1)!.id : null }
  }

  async get(workspaceId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, workspaceId } })
    // 404, not 403: do not reveal that the id exists in another workspace.
    if (!project) throw new NotFoundException()
    return project
  }

  async create(workspaceId: string, actorId: string, data: z.output<typeof createProject>) {
    try {
      const project = await this.prisma.project.create({ data: { ...data, workspaceId } })
      await this.record('project.create', workspaceId, actorId, project.id, data)
      return project
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('A project with this name exists')
      throw e
    }
  }

  async update(
    workspaceId: string,
    actorId: string,
    id: string,
    data: z.output<typeof updateProject>,
  ) {
    await this.get(workspaceId, id)
    try {
      const project = await this.prisma.project.update({ where: { id }, data })
      const action = data.status === 'archived' ? 'project.archive' : 'project.update'
      await this.record(action, workspaceId, actorId, id, data)
      return project
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('A project with this name exists')
      throw e
    }
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
      targetType: 'project',
      targetId,
      metadata: { fields: Object.keys(changes) },
    })
  }
}
