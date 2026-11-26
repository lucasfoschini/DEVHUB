import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import { OverviewService } from './overview.service.js'

@Controller('overview')
@UseGuards(SessionGuard)
export class OverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Get()
  async get(@Req() req: AuthedRequest) {
    return this.overview.get((await this.workspaces.personal(req.auth.user.id)).id)
  }
}
