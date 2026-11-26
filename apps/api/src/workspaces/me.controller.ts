import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { APIError } from 'better-auth/api'
import { fromNodeHeaders } from 'better-auth/node'
import type { Response } from 'express'
import { z } from 'zod'
import { AuditService } from '../audit/audit.service.js'
import { AUTH, type Auth } from '../auth/auth.js'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { PrismaService } from '../prisma.service.js'
import { parse } from '../validation.js'
import { WorkspacesService } from './workspaces.service.js'

const profile = z.object({ name: z.string().trim().min(1).max(80) })
const password = z.object({
  currentPassword: z.string().min(1).max(256),
  // Same minimum as Better Auth's config (auth.ts); max bounds the hashing cost.
  newPassword: z.string().min(12).max(256),
})

/** The signed-in user's own account: profile, password and sessions (Settings). */
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  @Get()
  async me(@Req() req: AuthedRequest) {
    const { user } = req.auth
    const workspace = await this.workspaces.personal(user.id)
    return {
      user: { id: user.id, name: user.name, email: user.email },
      workspace: { id: workspace.id, name: workspace.name, role: 'owner' as const },
    }
  }

  @Patch()
  async updateProfile(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { name } = parse(profile, body)
    const userId = req.auth.user.id
    await this.prisma.user.update({ where: { id: userId }, data: { name } })
    await this.audit.record({
      action: 'user.update',
      actorId: userId,
      metadata: { fields: ['name'] },
    })
    return { name }
  }

  /** Changes the password through Better Auth (verifies the current one) and signs out every
   *  other session, so a leaked session does not survive the change. */
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
  ) {
    const data = parse(password, body)
    try {
      const { headers } = await this.auth.api.changePassword({
        body: { ...data, revokeOtherSessions: true },
        headers: fromNodeHeaders(req.headers),
        returnHeaders: true,
      })
      // Better Auth replaces every session, the current one included: forward the new cookie.
      for (const cookie of headers.getSetCookie()) res.append('Set-Cookie', cookie)
    } catch (e) {
      // Better Auth reports a wrong current password as an APIError (400), not a crash.
      if (e instanceof APIError) throw new HttpException({ message: e.message }, e.statusCode)
      throw e
    }
    await this.audit.record({ action: 'auth.password_change', actorId: req.auth.user.id })
  }

  /** Active sessions without their tokens: a token is a credential and never leaves the API. */
  @Get('sessions')
  async sessions(@Req() req: AuthedRequest) {
    const rows = await this.prisma.session.findMany({
      where: { userId: req.auth.user.id, expiresAt: { gt: new Date() } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, createdAt: true, updatedAt: true, ipAddress: true, userAgent: true },
    })
    return rows.map((s) => ({ ...s, current: s.id === req.auth.session.id }))
  }

  /** Revokes one of the user's other sessions. The current one ends with sign-out. */
  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(@Req() req: AuthedRequest, @Param('id') id: string) {
    const sessionId = parse(z.string().min(1).max(128), id)
    const userId = req.auth.user.id
    const { count } = await this.prisma.session.deleteMany({
      where: { id: sessionId, userId, NOT: { id: req.auth.session.id } },
    })
    if (count === 0) throw new NotFoundException()
    await this.audit.record({
      action: 'auth.session_revoke',
      actorId: userId,
      targetType: 'session',
      targetId: sessionId,
    })
  }
}
