import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { WorkspacesService } from './workspaces.service.js'

@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  async me(@Req() req: AuthedRequest) {
    const { user } = req.auth
    const workspace = await this.workspaces.personal(user.id)
    return {
      user: { id: user.id, name: user.name, email: user.email },
      workspace: { id: workspace.id, name: workspace.name, role: 'owner' as const },
    }
  }
}
