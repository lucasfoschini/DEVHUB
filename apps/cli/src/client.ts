import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The signed-in session: the DevHub web origin and its Better Auth cookie. The session is a
 *  normal one, so Settings → Sessões lists it and can revoke it. */
export interface Config {
  url: string
  cookie: string
}

const dir = () => process.env.DEVHUB_CONFIG_DIR ?? join(homedir(), '.devhub')
const file = () => join(dir(), 'config.json')

export function loadConfig(): Config | null {
  try {
    return JSON.parse(readFileSync(file(), 'utf8')) as Config
  } catch {
    return null
  }
}

export function saveConfig(config: Config) {
  mkdirSync(dir(), { recursive: true })
  writeFileSync(file(), JSON.stringify(config, null, 2), { mode: 0o600 })
  // Windows ignores the mode; the file sits in the user's profile, readable only by them.
  chmodSync(file(), 0o600)
}

export const clearConfig = () => rmSync(file(), { force: true })

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** `name=value` pairs from Set-Cookie headers, for the Cookie header of later requests. */
export function cookiePairs(setCookies: string[]) {
  return setCookies
    .map((c) => c.split(';')[0]!.trim())
    .filter((c) => c.includes('=') && !c.endsWith('='))
    .join('; ')
}

/** Calls the API through the web origin (as the browser does), so the CSRF origin check and
 *  first-party cookies work unchanged. */
export async function api<T>(
  config: Pick<Config, 'url'> & Partial<Config>,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: T; headers: Headers }> {
  const origin = new URL(config.url).origin
  let res: Response
  try {
    res = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        Origin: origin,
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(config.cookie && { Cookie: config.cookie }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    throw new ApiError(0, `Sem conexão com ${origin} (${(e as Error).message})`)
  }
  if (!res.ok) {
    const text = await res.text()
    let message = text
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, `HTTP ${res.status}${message ? `: ${message}` : ''}`)
  }
  const data = (res.status === 204 ? null : await res.json()) as T
  return { data, headers: res.headers }
}
