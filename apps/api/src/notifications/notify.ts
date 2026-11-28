import type { Prisma } from '../generated/prisma/client.js'

/** Every kind the API emits. Settings can mute any of them per workspace. */
export const NOTIFICATION_KINDS = [
  'monitor.down',
  'monitor.recovered',
  'integration.needs_reconnect',
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export const WEBHOOK_FORMATS = ['generic', 'slack', 'discord'] as const
export type WebhookFormat = (typeof WEBHOOK_FORMATS)[number]

type Db = Pick<
  Prisma.TransactionClient,
  'workspace' | 'notification' | 'automation' | 'automationRun'
>
type Data = Omit<Prisma.NotificationUncheckedCreateInput, 'kind'> & { kind: NotificationKind }

/** The JSON body a webhook receives, in the shape its service expects. */
export function webhookPayload(
  format: string,
  data: Pick<Data, 'kind' | 'title'> & { body?: string; severity?: string; href?: string | null },
) {
  const line = data.body ? `${data.title} — ${data.body}` : data.title
  if (format === 'slack') return JSON.stringify({ text: line })
  if (format === 'discord') return JSON.stringify({ content: line })
  return JSON.stringify({
    source: 'devhub',
    event: data.kind,
    severity: data.severity,
    title: data.title,
    body: data.body ?? '',
    path: data.href ?? null,
  })
}

/** Event triggers fire only when the condition text appears in the title or body. */
export function matches(condition: string | null, event: { title: string; body?: string }) {
  if (!condition) return true
  return `${event.title}\n${event.body ?? ''}`.toLowerCase().includes(condition.toLowerCase())
}

/** Kind of the notifications the notification action creates. Not a trigger, so an automation
 *  can never fire another one (no loops). */
export const AUTOMATION_KIND = 'automation'

export interface Firing {
  id: string
  workspaceId: string
  action: string
  format: string
  message: string | null
}
export interface AutomationEvent {
  kind: string
  severity: 'info' | 'success' | 'warning' | 'critical'
  title: string
  body?: string
  href?: string | null
}

/** Runs one automation's action. Webhooks are queued for the worker (outbox) unless `claimed`,
 *  in which case the caller delivers. The notification action completes here. */
export async function fire(
  db: Pick<Prisma.TransactionClient, 'notification' | 'automationRun'>,
  a: Firing,
  event: AutomationEvent,
  claimed = false,
) {
  const title = a.message || event.title
  if (a.action === 'notification') {
    await db.notification.create({
      data: {
        workspaceId: a.workspaceId,
        kind: AUTOMATION_KIND,
        severity: event.severity,
        title: title.slice(0, 200),
        body: event.body ?? '',
        href: event.href ?? '/automations',
      },
    })
    return db.automationRun.create({
      data: {
        automationId: a.id,
        payload: JSON.stringify({ title, body: event.body ?? '' }),
        status: 'succeeded',
        attempts: 1,
        finishedAt: new Date(),
      },
    })
  }
  return db.automationRun.create({
    data: {
      automationId: a.id,
      attempts: claimed ? 1 : 0,
      payload: webhookPayload(a.format, { ...event, kind: event.kind as NotificationKind, title }),
    },
  })
}

/** Creates a notification unless the workspace muted its kind, and fires the enabled
 *  automations for that kind whose condition matches (outbox: same transaction).
 *  Automations fire even when the in-app notification is muted. */
export async function notify(db: Db, { data }: { data: Data }) {
  const ws = await db.workspace.findUnique({
    where: { id: data.workspaceId },
    select: { mutedNotificationKinds: true },
  })
  if (!ws?.mutedNotificationKinds.includes(data.kind)) await db.notification.create({ data })

  const automations = await db.automation.findMany({
    where: { workspaceId: data.workspaceId, trigger: data.kind, enabled: true },
    select: {
      id: true,
      workspaceId: true,
      action: true,
      format: true,
      message: true,
      condition: true,
    },
  })
  for (const a of automations) {
    if (matches(a.condition, data)) await fire(db, a, data)
  }
}
