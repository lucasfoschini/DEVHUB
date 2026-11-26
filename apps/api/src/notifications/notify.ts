import type { Prisma } from '../generated/prisma/client.js'

/** Every kind the API emits. Settings can mute any of them per workspace. */
export const NOTIFICATION_KINDS = [
  'monitor.down',
  'monitor.recovered',
  'integration.needs_reconnect',
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

type Db = Pick<Prisma.TransactionClient, 'workspace' | 'notification'>

/** Creates a notification unless the workspace muted its kind. Works inside a transaction. */
export async function notify(
  db: Db,
  {
    data,
  }: { data: Omit<Prisma.NotificationUncheckedCreateInput, 'kind'> & { kind: NotificationKind } },
) {
  const ws = await db.workspace.findUnique({
    where: { id: data.workspaceId },
    select: { mutedNotificationKinds: true },
  })
  if (ws?.mutedNotificationKinds.includes(data.kind)) return
  await db.notification.create({ data })
}
