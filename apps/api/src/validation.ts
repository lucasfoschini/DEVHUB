import { BadRequestException } from '@nestjs/common'
import type { z } from 'zod'

/** Parses untrusted input with an allowlist schema; unknown keys are stripped, so fields such as
 *  `workspaceId` in a body can never reach Prisma (mass assignment, THREAT_MODEL.md B1). */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new BadRequestException({
      message: 'Invalid request',
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  return result.data
}
