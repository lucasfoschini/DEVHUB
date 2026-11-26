import { z } from 'zod'
import { urlProblem } from './ssrf.ts'

const url = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => urlProblem(v) === null, 'URL must be http(s) without credentials')

const fields = {
  name: z.string().trim().min(1).max(80),
  url,
  intervalSeconds: z.number().int().min(60).max(3600),
  timeoutMs: z.number().int().min(1000).max(10000),
  enabled: z.boolean(),
  projectId: z.uuid().nullable(),
}

export const createMonitor = z.object({
  name: fields.name,
  url: fields.url,
  intervalSeconds: fields.intervalSeconds.optional(),
  timeoutMs: fields.timeoutMs.optional(),
  projectId: fields.projectId.optional(),
})

export const updateMonitor = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

export const monitorId = z.uuid()

/** Per-workspace cap: bounds outbound traffic and scheduler load. */
export const MAX_MONITORS = 50
