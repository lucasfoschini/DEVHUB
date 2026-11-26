import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'

const RECENT = 5

/** Command Center data (MASTER_PLAN §7.1) in one round trip. Only observed facts: counts,
 *  states and timestamps; nothing is estimated. Scoped by the session's workspace. */
@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async get(workspaceId: string) {
    const [byStatus, recentProjects, monitors, openIncidents, recentPushes, github, unread] =
      await Promise.all([
        this.prisma.project.groupBy({
          by: ['status'],
          where: { workspaceId },
          _count: { _all: true },
        }),
        this.prisma.project.findMany({
          where: { workspaceId, status: { not: 'archived' } },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: RECENT,
          select: { id: true, name: true, status: true, updatedAt: true },
        }),
        this.prisma.monitor.findMany({
          where: { workspaceId },
          select: { state: true, enabled: true },
        }),
        this.prisma.incident.findMany({
          where: { workspaceId, resolvedAt: null },
          orderBy: { openedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            cause: true,
            openedAt: true,
            monitor: {
              select: { id: true, name: true, project: { select: { id: true, name: true } } },
            },
          },
        }),
        this.prisma.repository.findMany({
          where: { workspaceId, pushedAt: { not: null } },
          orderBy: { pushedAt: 'desc' },
          take: RECENT,
          select: { id: true, fullName: true, pushedAt: true, lastSyncAt: true },
        }),
        this.prisma.integration.findUnique({
          where: { workspaceId_provider: { workspaceId, provider: 'github' } },
          select: { status: true, externalLogin: true },
        }),
        this.prisma.notification.count({ where: { workspaceId, readAt: null } }),
      ])

    const count = (pred: (m: (typeof monitors)[number]) => boolean) => monitors.filter(pred).length
    return {
      projects: {
        byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
        recent: recentProjects,
      },
      monitors: {
        total: monitors.length,
        up: count((m) => m.enabled && m.state === 'up'),
        down: count((m) => m.enabled && m.state === 'down'),
        unknown: count((m) => m.enabled && m.state === 'unknown'),
        paused: count((m) => !m.enabled),
      },
      openIncidents,
      recentPushes,
      github,
      unreadNotifications: unread,
    }
  }
}
