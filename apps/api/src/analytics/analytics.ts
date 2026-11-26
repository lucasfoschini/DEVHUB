import { Controller, Get, Injectable, Query, Req, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { MIN_SAMPLES } from '../monitors/stats.js'
import { PrismaService } from '../prisma.service.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'

const query = z.object({ days: z.enum(['7', '30']).default('7') })

interface DayRow {
  day: Date
  checks: number
  failures: number
  okSamples: number
  p95: number | null
}

/** Analytics over observed monitor checks and incidents. Days are UTC. Percentiles need
 *  MIN_SAMPLES successful samples, otherwise null (same rule as monitors). */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(workspaceId: string, days: number) {
    const [daily, incidents, perMonitor] = await Promise.all([
      this.prisma.$queryRaw<DayRow[]>`
        SELECT date_trunc('day', c."checkedAt") AS day,
               count(*)::int AS checks,
               count(*) FILTER (WHERE NOT c.ok)::int AS failures,
               count(c."latencyMs") FILTER (WHERE c.ok)::int AS "okSamples",
               (percentile_cont(0.95) WITHIN GROUP (ORDER BY c."latencyMs")
                 FILTER (WHERE c.ok))::float8 AS p95
        FROM monitor_check c JOIN monitor m ON m.id = c."monitorId"
        WHERE m."workspaceId" = ${workspaceId}
          AND c."checkedAt" >= date_trunc('day', now()) - make_interval(days => ${days - 1})
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ opened: number; resolved: number; mttrSeconds: number | null }[]>`
        SELECT count(*)::int AS opened,
               count(*) FILTER (WHERE "resolvedAt" IS NOT NULL)::int AS resolved,
               (avg(extract(epoch FROM "resolvedAt" - "openedAt"))
                 FILTER (WHERE "resolvedAt" IS NOT NULL))::float8 AS "mttrSeconds"
        FROM incident
        WHERE "workspaceId" = ${workspaceId}
          AND "openedAt" >= date_trunc('day', now()) - make_interval(days => ${days - 1})`,
      this.prisma.$queryRaw<{ id: string; name: string; checks: number; failures: number }[]>`
        SELECT m.id, m.name, count(c.id)::int AS checks,
               count(c.id) FILTER (WHERE NOT c.ok)::int AS failures
        FROM monitor m
        LEFT JOIN monitor_check c ON c."monitorId" = m.id
          AND c."checkedAt" >= date_trunc('day', now()) - make_interval(days => ${days - 1})
        WHERE m."workspaceId" = ${workspaceId}
        GROUP BY m.id, m.name ORDER BY m.name`,
    ])

    const uptime = (checks: number, failures: number) =>
      checks === 0 ? null : (checks - failures) / checks
    return {
      days,
      daily: daily.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        checks: d.checks,
        uptime: uptime(d.checks, d.failures),
        p95: d.okSamples >= MIN_SAMPLES && d.p95 !== null ? Math.round(d.p95) : null,
      })),
      incidents: incidents[0] ?? { opened: 0, resolved: 0, mttrSeconds: null },
      monitors: perMonitor.map((m) => ({
        id: m.id,
        name: m.name,
        checks: m.checks,
        uptime: uptime(m.checks, m.failures),
      })),
    }
  }
}

@Controller('analytics')
@UseGuards(SessionGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Get()
  async get(@Req() req: AuthedRequest, @Query() raw: unknown) {
    const { days } = parse(query, raw)
    const ws = (await this.workspaces.personal(req.auth.user.id)).id
    return this.analytics.get(ws, Number(days))
  }
}
