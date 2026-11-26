import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import type { Env } from '../env.js'
import type { PrismaClient } from '../generated/prisma/client.js'

export const AUTH = Symbol('AUTH')

type Audit = (action: string, actorId: string) => Promise<unknown>

/** Better Auth instance (ADR 0003). Email and password only in Phase 1. */
export function createAuth(prisma: PrismaClient, env: Env, audit: Audit) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: env.secret,
    // The browser reaches the API through the web origin (Vite proxy in dev).
    baseURL: env.webOrigin,
    trustedOrigins: [env.webOrigin],
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    telemetry: { enabled: false },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await audit('auth.sign_up', user.id)
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            await audit('auth.sign_in', session.userId)
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
