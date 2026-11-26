import { Injectable } from '@nestjs/common'
import type { Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma.service.js'

export interface AuditEntry {
  action: string
  actorId?: string | null
  workspaceId?: string | null
  targetType?: string
  targetId?: string
  metadata?: Prisma.InputJsonValue
}

/** Append-only: this service exposes no update or delete. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry) {
    return this.prisma.auditLog.create({ data: entry })
  }
}
