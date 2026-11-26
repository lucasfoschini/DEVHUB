import { Injectable } from '@nestjs/common'
import { AuditService } from '../audit/audit.service.js'
import { PrismaService } from '../prisma.service.js'
import { NOTIFICATION_KINDS, type NotificationKind } from './notify.js'

const PAGE = 50

/** In-app notifications, always scoped by the session's workspace (THREAT_MODEL.md B1). */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(workspaceId: string, unreadOnly: boolean) {
    const where = { workspaceId, ...(unreadOnly ? { readAt: null } : {}) }
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: PAGE }),
      this.prisma.notification.count({ where: { workspaceId, readAt: null } }),
    ])
    return { items, unread }
  }

  /** Marks one (or all, without `id`) as read. Another workspace's id matches nothing. */
  async markRead(workspaceId: string, id?: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { workspaceId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    })
    return { updated: count }
  }

  async preferences(workspaceId: string) {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { mutedNotificationKinds: true },
    })
    return { kinds: NOTIFICATION_KINDS, muted: ws.mutedNotificationKinds }
  }

  async setMuted(workspaceId: string, actorId: string, muted: NotificationKind[]) {
    const unique = [...new Set(muted)]
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { mutedNotificationKinds: unique },
    })
    await this.audit.record({
      action: 'settings.notifications',
      workspaceId,
      actorId,
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { muted: unique },
    })
    return { kinds: NOTIFICATION_KINDS, muted: unique }
  }
}
