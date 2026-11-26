import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import { NotificationsService } from './notifications.service.js'
import { NOTIFICATION_KINDS } from './notify.js'

const listQuery = z.object({ unread: z.enum(['true', 'false']).default('false') })
const preferences = z.object({
  muted: z.array(z.enum(NOTIFICATION_KINDS)).max(NOTIFICATION_KINDS.length * 2),
})

@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const { unread } = parse(listQuery, query)
    return this.notifications.list(await this.workspaceId(req), unread === 'true')
  }

  @Post('read-all')
  @HttpCode(200)
  async readAll(@Req() req: AuthedRequest) {
    return this.notifications.markRead(await this.workspaceId(req))
  }

  @Post(':id/read')
  @HttpCode(200)
  async read(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.notifications.markRead(await this.workspaceId(req), parse(z.uuid(), id))
  }

  @Get('preferences')
  async preferences(@Req() req: AuthedRequest) {
    return this.notifications.preferences(await this.workspaceId(req))
  }

  @Put('preferences')
  async setPreferences(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { muted } = parse(preferences, body)
    return this.notifications.setMuted(await this.workspaceId(req), req.auth.user.id, muted)
  }
}
