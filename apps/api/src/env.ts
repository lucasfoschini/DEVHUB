/** Reads and validates configuration once at boot, so a missing value fails fast. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const missing = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'WEB_ORIGIN'].filter((k) => !source[k])
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  const secret = source.BETTER_AUTH_SECRET!
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters')
  const webOrigin = new URL(source.WEB_ORIGIN!).origin
  const port = Number(source.PORT ?? 3000)
  if (!Number.isInteger(port) || port <= 0) throw new Error('PORT must be a positive integer')
  return { databaseUrl: source.DATABASE_URL!, secret, webOrigin, port }
}

export type Env = ReturnType<typeof loadEnv>
