import { Controller, Delete, Get, Inject, Query, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { z } from 'zod'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { ENV_TOKEN } from '../env-token.js'
import type { Env } from '../env.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import { ACCESS_SCOPES, GithubService, type Access } from './github.service.js'

const COOKIE = 'dh_gh_oauth'
const COOKIE_PATH = '/api/integrations/github'

const startQuery = z.object({
  access: z.enum(Object.keys(ACCESS_SCOPES) as [Access, ...Access[]]).default('public'),
})

function readCookie(header: string | undefined, name: string) {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

@Controller('integrations')
@UseGuards(SessionGuard)
export class IntegrationsController {
  constructor(
    private readonly github: GithubService,
    private readonly workspaces: WorkspacesService,
    @Inject(ENV_TOKEN) private readonly env: Env,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  private cookie(value: string, maxAge: number) {
    const secure = this.env.webOrigin.startsWith('https:') ? '; Secure' : ''
    return `${COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=${COOKIE_PATH}; Max-Age=${maxAge}${secure}`
  }

  @Get('github')
  async status(@Req() req: AuthedRequest) {
    return this.github.status(await this.workspaceId(req))
  }

  /** Top-level navigation from the web app: sets the state cookie and redirects to GitHub. */
  @Get('github/connect')
  connect(@Query() query: unknown, @Res() res: Response) {
    const { access } = parse(startQuery, query)
    const { url, cookieValue } = this.github.start(access)
    res.setHeader('Set-Cookie', this.cookie(cookieValue, 600))
    res.redirect(302, url)
  }

  /** GitHub redirects here. Always clears the state cookie and returns to the Git Center. */
  @Get('github/callback')
  async callback(
    @Req() req: AuthedRequest,
    @Query() query: { code?: string; state?: string },
    @Res() res: Response,
  ) {
    res.setHeader('Set-Cookie', this.cookie('', 0))
    let outcome = 'connected'
    try {
      await this.github.complete(
        await this.workspaceId(req),
        req.auth.user.id,
        { code: query.code, state: query.state },
        readCookie(req.headers.cookie, COOKIE),
      )
    } catch {
      outcome = 'error'
    }
    res.redirect(302, `${this.env.webOrigin}/git?github=${outcome}`)
  }

  @Delete('github')
  async disconnect(@Req() req: AuthedRequest) {
    return this.github.disconnect(await this.workspaceId(req), req.auth.user.id)
  }
}
