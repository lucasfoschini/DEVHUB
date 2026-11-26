import { parseKey } from './integrations/crypto.ts'

/** Reads and validates configuration once at boot, so a missing value fails fast. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const missing = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'WEB_ORIGIN'].filter((k) => !source[k])
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  const secret = source.BETTER_AUTH_SECRET!
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters')
  const webOrigin = new URL(source.WEB_ORIGIN!).origin
  const port = Number(source.PORT ?? 3000)
  if (!Number.isInteger(port) || port <= 0) throw new Error('PORT must be a positive integer')
  // Development and tests only: lets monitors reach private addresses (SSRF guard off).
  const allowPrivateMonitors = source.MONITOR_ALLOW_PRIVATE === 'true'
  return {
    databaseUrl: source.DATABASE_URL!,
    secret,
    webOrigin,
    port,
    allowPrivateMonitors,
    /** AES-256 key for stored credentials (integration tokens, Secrets Vault). Optional: features
     *  that need it answer 503 without it. */
    encryptionKey: source.ENCRYPTION_KEY ? parseKey(source.ENCRYPTION_KEY) : null,
    github: loadGithub(source, webOrigin),
    /** Read-only provider APIs (Phase 4); overridable so tests use a local fake. */
    providerApi: {
      render: source.RENDER_API_BASE ?? 'https://api.render.com',
      vercel: source.VERCEL_API_BASE ?? 'https://api.vercel.com',
      neon: source.NEON_API_BASE ?? 'https://console.neon.tech',
    },
  }
}

/** GitHub is optional: without GITHUB_CLIENT_ID the integration is reported as not configured.
 *  When it is set, the secret and the token encryption key are required. */
function loadGithub(source: NodeJS.ProcessEnv, webOrigin: string) {
  if (!source.GITHUB_CLIENT_ID) return null
  const missing = ['GITHUB_CLIENT_SECRET', 'ENCRYPTION_KEY'].filter((k) => !source[k])
  if (missing.length) throw new Error(`GitHub is configured but missing: ${missing.join(', ')}`)
  return {
    clientId: source.GITHUB_CLIENT_ID,
    clientSecret: source.GITHUB_CLIENT_SECRET!,
    encryptionKey: parseKey(source.ENCRYPTION_KEY!),
    // The browser reaches the API through the web origin, so the callback lives there too.
    redirectUri: `${webOrigin}/api/integrations/github/callback`,
    // Overridable for tests (a local fake) and, later, GitHub Enterprise Server.
    oauthBase: source.GITHUB_OAUTH_BASE ?? 'https://github.com',
    apiBase: source.GITHUB_API_BASE ?? 'https://api.github.com',
  }
}

export type Env = ReturnType<typeof loadEnv>
