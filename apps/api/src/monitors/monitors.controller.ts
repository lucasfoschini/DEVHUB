import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import { createMonitor, monitorId, updateMonitor } from './monitors.schema.js'
import { MonitorsService } from './monitors.service.js'

@Controller('monitors')
@UseGuards(SessionGuard)
export class MonitorsController {
  constructor(
    private readonly monitors: MonitorsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.monitors.list(await this.workspaceId(req))
  }

  @Get(':id')
  async get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.monitors.get(await this.workspaceId(req), parse(monitorId, id))
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(createMonitor, body)
    return this.monitors.create(await this.workspaceId(req), req.auth.user.id, data)
  }

  @Patch(':id')
  async update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const data = parse(updateMonitor, body)
    return this.monitors.update(
      await this.workspaceId(req),
      req.auth.user.id,
      parse(monitorId, id),
      data,
    )
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.monitors.remove(await this.workspaceId(req), req.auth.user.id, parse(monitorId, id))
  }

  @Post(':id/check')
  async checkNow(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.monitors.checkNow(await this.workspaceId(req), parse(monitorId, id))
  }
}
