import { useSyncExternalStore } from 'react'

// Client-side registry of long-running operations shown in the Activity Shelf.
// Producers (deploys, syncs, Local Agent jobs) call start/update; the shelf only renders.

export type ActivityKind = 'deploy' | 'build' | 'sync' | 'index' | 'ai' | 'automation' | 'backup'
export type ActivityStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface Activity {
  id: string
  kind: ActivityKind
  title: string
  project?: string
  status: ActivityStatus
  /** 0..1, only when the source reports real progress. Undefined = indeterminate. */
  progress?: number
  step?: string
  error?: string
  startedAt: number
  endedAt?: number
  /** True for prototype simulations; the UI labels them. */
  simulated: boolean
  detailsHref?: string
  /** Present only when the source supports the operation. */
  controls?: { pause?: () => void; resume?: () => void; cancel?: () => void }
}

export const isFinal = (s: ActivityStatus) =>
  s === 'completed' || s === 'failed' || s === 'cancelled'

/** Finished items leave on their own; failures stay until dismissed. */
const AUTO_DISMISS_MS = 8000

let items: Activity[] = []
let announcement = ''
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const finalText: Record<string, string> = {
  completed: 'concluído',
  failed: 'falhou',
  cancelled: 'cancelado',
}

export const activity = {
  list: () => items,

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  start(input: Omit<Activity, 'id' | 'status' | 'startedAt'>): string {
    const id = crypto.randomUUID()
    items = [{ ...input, id, status: 'running', startedAt: Date.now() }, ...items]
    announcement = `${input.title}: iniciado`
    emit()
    return id
  },

  update(id: string, patch: Partial<Omit<Activity, 'id' | 'startedAt'>>) {
    const current = items.find((i) => i.id === id)
    if (!current || isFinal(current.status)) return
    const next: Activity = { ...current, ...patch }
    if (next.progress !== undefined) next.progress = Math.min(1, Math.max(0, next.progress))
    if (isFinal(next.status)) {
      next.endedAt = Date.now()
      next.controls = undefined
      announcement = `${next.title}: ${finalText[next.status]}`
      if (next.status !== 'failed') setTimeout(() => activity.dismiss(id), AUTO_DISMISS_MS)
    }
    items = items.map((i) => (i.id === id ? next : i))
    emit()
  },

  dismiss(id: string) {
    const before = items.length
    items = items.filter((i) => i.id !== id)
    if (items.length !== before) emit()
  },
}

export const useActivities = () => useSyncExternalStore(activity.subscribe, activity.list)
export const useActivityAnnouncement = () =>
  useSyncExternalStore(activity.subscribe, () => announcement)
