import { z } from 'zod'

export const PROJECT_STATUSES = [
  'planning',
  'development',
  'testing',
  'production',
  'maintenance',
  'archived',
] as const

const name = z.string().trim().min(1).max(80)
const description = z.string().trim().max(2000)
const status = z.enum(PROJECT_STATUSES)

export const createProject = z.object({
  name,
  description: description.optional(),
  status: status.optional(),
})

export const updateProject = z
  .object({ name, description, status })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

export const listProjects = z.object({
  status: status.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
})

export const projectId = z.uuid()
