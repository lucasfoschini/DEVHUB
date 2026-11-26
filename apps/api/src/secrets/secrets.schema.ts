import { z } from 'zod'

export const ENVIRONMENTS = ['development', 'staging', 'production'] as const
export const MAX_SECRETS = 500

const value = z.string().min(1).max(10_000)
const description = z.string().trim().max(500)

export const createSecret = z.object({
  projectId: z.uuid(),
  name: z
    .string()
    .trim()
    .regex(/^[A-Z_][A-Z0-9_]{0,127}$/, 'Use UPPER_SNAKE_CASE'),
  environment: z.enum(ENVIRONMENTS),
  value,
  description: description.optional(),
})

export const updateSecret = z
  .object({ value, description })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

export const listSecrets = z.object({ projectId: z.uuid().optional() })
