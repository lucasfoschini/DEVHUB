import { Injectable } from '@nestjs/common'
import { AuditService } from '../audit/audit.service.js'
import { PrismaService } from '../prisma.service.js'

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The user's personal workspace, created on first use. `personalFor` is unique, so
   *  concurrent first requests cannot create two. */
  async personal(userId: string) {
    const existing = await this.prisma.workspace.findUnique({ where: { personalFor: userId } })
    if (existing) return existing
    try {
      const created = await this.prisma.workspace.create({
        data: {
          name: 'Pessoal',
          personalFor: userId,
          memberships: { create: { userId, role: 'owner' } },
        },
      })
      await this.audit.record({
        action: 'workspace.create',
        actorId: userId,
        workspaceId: created.id,
        targetType: 'workspace',
        targetId: created.id,
      })
      return created
    } catch (e) {
      // Lost the race to a concurrent request, which created it.
      if ((e as { code?: string }).code === 'P2002') {
        return this.prisma.workspace.findUniqueOrThrow({ where: { personalFor: userId } })
      }
      throw e
    }
  }
}
