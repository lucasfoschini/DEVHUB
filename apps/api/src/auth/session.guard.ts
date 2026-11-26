import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { fromNodeHeaders } from 'better-auth/node'
import type { Request } from 'express'
import { AUTH, type Auth } from './auth.js'

export type AuthSession = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>
export type AuthedRequest = Request & { auth: AuthSession }

/** Rejects requests without a valid Better Auth session and attaches it as `req.auth`. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) throw new UnauthorizedException()
    req.auth = session
    return true
  }
}
