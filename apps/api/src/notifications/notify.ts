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

/** Creates a notification unless the workspace muted its kind, and queues the webhook runs of
 *  enabled automations for that kind (outbox: same transaction, delivered by a worker).
 *  Automations fire even when the in-app notification is muted. */
export async function notify(db: Db, { data }: { data: Data }) {
  const ws = await db.workspace.findUnique({
    where: { id: data.workspaceId },
    select: { mutedNotificationKinds: true },
  })
  if (!ws?.mutedNotificationKinds.includes(data.kind)) await db.notification.create({ data })

  const automations = await db.automation.findMany({
    where: { workspaceId: data.workspaceId, trigger: data.kind, enabled: true },
    select: { id: true, format: true },
  })
  if (automations.length === 0) return
  await db.automationRun.createMany({
    data: automations.map((a) => ({ automationId: a.id, payload: webhookPayload(a.format, data) })),
  })
}
