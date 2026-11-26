import { UnprocessableEntityException } from '@nestjs/common'
import type { PrismaService } from '../prisma.service.js'

/** Refuses a projectId from another workspace with the same answer as a missing one. */
export async function assertProject(
  prisma: PrismaService,
  workspaceId: string,
  projectId: string | null | undefined,
) {
  if (!projectId) return
  const found = await prisma.project.findFirst({ where: { id: projectId, workspaceId } })
  if (!found) throw new UnprocessableEntityException('Project not found')
}
