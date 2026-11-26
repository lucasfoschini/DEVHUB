import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { AuditService } from '../audit/audit.service.js'
import { ENV_TOKEN } from '../env-token.js'
import type { Env } from '../env.js'
import { notify } from '../notifications/notify.js'
import { PrismaService } from '../prisma.service.js'
import { decrypt, encrypt } from './crypto.js'

const PROVIDER = 'github'
const TIMEOUT_MS = 10_000

/** OAuth Apps have no read-only scope for private repositories: `repo` is the only way to read
 *  them and it also allows writes. The user chooses; DevHub only ever calls read endpoints. */
export const ACCESS_SCOPES = {
  public: 'read:user',
  private: 'read:user repo',
} as const
export type Access = keyof typeof ACCESS_SCOPES

/** Thrown when GitHub rejects the stored token; the integration is marked for reconnection. */
export class GithubAuthError extends Error {}

const b64url = (buf: Buffer) => buf.toString('base64url')

@Injectable()
export class GithubService {
  private readonly log = new Logger('GitHub')

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV_TOKEN) private readonly env: Env,
  ) {}

  private get config() {
    if (!this.env.github) throw new ServiceUnavailableException('GitHub is not configured')
    return this.env.github
  }

  async status(workspaceId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: PROVIDER } },
      select: {
        externalLogin: true,
        scopes: true,
        status: true,
        createdAt: true,
        lastSyncAt: true,
      },
    })
    return { configured: this.env.github !== null, integration }
  }

  /** Authorization URL plus the state/PKCE verifier to keep in a short-lived HttpOnly cookie. */
  start(access: Access) {
    const c = this.config
    const state = b64url(randomBytes(32))
    const verifier = b64url(randomBytes(32))
    const challenge = b64url(createHash('sha256').update(verifier).digest())
    const url = new URL('/login/oauth/authorize', c.oauthBase)
    url.search = new URLSearchParams({
      client_id: c.clientId,
      redirect_uri: c.redirectUri,
      scope: ACCESS_SCOPES[access],
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      allow_signup: 'false',
    }).toString()
    return { url: url.toString(), cookieValue: `${state}.${verifier}` }
  }

  /** Validates state, exchanges the code (with PKCE), stores the encrypted token. */
  async complete(
    workspaceId: string,
    actorId: string,
    query: { code?: string; state?: string },
    cookieValue: string | undefined,
  ) {
    const [expected, verifier] = (cookieValue ?? '').split('.')
    if (
      !query.code ||
      !query.state ||
      !expected ||
      !verifier ||
      !sameString(query.state, expected)
    ) {
      throw new BadRequestException('Invalid OAuth state')
    }
    const c = this.config
    const tokenRes = await this.fetch(new URL('/login/oauth/access_token', c.oauthBase), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        code: query.code,
        redirect_uri: c.redirectUri,
        code_verifier: verifier,
      }),
    })
    const token = (await tokenRes.json()) as {
      access_token?: string
      scope?: string
      error?: string
    }
    if (!token.access_token) {
      // Log the provider's error code only, never the request (it holds the secret and code).
      this.log.warn(`Token exchange failed: ${token.error ?? tokenRes.status}`)
      throw new BadRequestException('GitHub did not issue a token')
    }
    const userRes = await this.api(token.access_token, '/user')
    const user = (await userRes.json()) as { id: number; login: string }
    const scopes = (token.scope ?? '').split(',').filter(Boolean)
    const data = {
      externalId: String(user.id),
      externalLogin: user.login,
      scopes,
      encryptedToken: encrypt(token.access_token, c.encryptionKey),
      status: 'connected' as const,
      connectedById: actorId,
    }
    await this.prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider: PROVIDER } },
      create: { ...data, workspaceId, provider: PROVIDER },
      update: data,
    })
    await this.audit.record({
      action: 'integration.connect',
      workspaceId,
      actorId,
      targetType: 'integration',
      targetId: PROVIDER,
      metadata: { login: user.login, scopes },
    })
  }

  /** Revokes the grant at GitHub (so the token stops working everywhere), then forgets it.
   *  The local record is removed even if GitHub is unreachable; the result is audited. */
  async disconnect(workspaceId: string, actorId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: PROVIDER } },
    })
    if (!integration) throw new NotFoundException()
    const c = this.config
    let revoked = false
    try {
      const res = await this.fetch(new URL(`/applications/${c.clientId}/grant`, c.apiBase), {
        method: 'DELETE',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: decrypt(integration.encryptedToken, c.encryptionKey),
        }),
      })
      // 404: the grant was already revoked on GitHub's side.
      revoked = res.status === 204 || res.status === 404
    } catch (e) {
      this.log.warn(`Grant revocation failed: ${(e as Error).message}`)
    }
    await this.prisma.integration.delete({ where: { id: integration.id } })
    await this.audit.record({
      action: 'integration.disconnect',
      workspaceId,
      actorId,
      targetType: 'integration',
      targetId: PROVIDER,
      metadata: { revokedAtProvider: revoked },
    })
    return { revokedAtProvider: revoked }
  }

  /** Authenticated GET against the GitHub API for this workspace (used by repository import). */
  async get(workspaceId: string, path: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: PROVIDER } },
    })
    if (!integration || integration.status !== 'connected') throw new GithubAuthError()
    const res = await this.api(decrypt(integration.encryptedToken, this.config.encryptionKey), path)
    if (res.status === 401) {
      // Only the request that flips the status notifies, so concurrent 401s send one.
      const { count } = await this.prisma.integration.updateMany({
        where: { id: integration.id, status: 'connected' },
        data: { status: 'needs_reconnect' },
      })
      if (count > 0) {
        await notify(this.prisma, {
          data: {
            workspaceId,
            kind: 'integration.needs_reconnect',
            severity: 'warning',
            title: 'GitHub desconectado',
            body: 'O GitHub recusou o token salvo. Conecte novamente para continuar.',
            href: '/git',
          },
        })
      }
      throw new GithubAuthError()
    }
    return res
  }

  private api(token: string, path: string) {
    return this.fetch(new URL(path, this.config.apiBase), {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  }

  private fetch(url: URL, init: RequestInit) {
    return fetch(url, {
      ...init,
      headers: { 'User-Agent': 'DevHub', ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  }
}

function sameString(a: string, b: string) {
  const [x, y] = [Buffer.from(a), Buffer.from(b)]
  return x.length === y.length && timingSafeEqual(x, y)
}
