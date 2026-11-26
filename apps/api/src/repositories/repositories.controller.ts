import {
  Body,
  Controller,
  Delete,
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
import { RepositoriesService } from './repositories.service.js'

const uuid = z.uuid()
const importBody = z.object({ externalId: z.string().regex(/^\d{1,20}$/) })
const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100).default(1) })

@Controller()
@UseGuards(SessionGuard)
export class RepositoriesController {
  constructor(
    private readonly repos: RepositoriesService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get('github/repos')
  async available(@Req() req: AuthedRequest, @Query() query: unknown) {
    return this.repos.available(await this.workspaceId(req), parse(pageQuery, query).page)
  }

  @Get('repositories')
  async list(@Req() req: AuthedRequest) {
    return this.repos.list(await this.workspaceId(req))
  }

  @Post('repositories')
  async import(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { externalId } = parse(importBody, body)
    return this.repos.import(await this.workspaceId(req), req.auth.user.id, externalId)
  }

  @Post('repositories/:id/sync')
  async sync(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.repos.sync(await this.workspaceId(req), parse(uuid, id))
  }

  @Delete('repositories/:id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.repos.remove(await this.workspaceId(req), req.auth.user.id, parse(uuid, id))
  }

  @Get('projects/:id/repositories')
  async forProject(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.repos.forProject(await this.workspaceId(req), parse(uuid, id))
  }

  @Put('projects/:id/repositories/:repoId')
  @HttpCode(204)
  async link(@Req() req: AuthedRequest, @Param('id') id: string, @Param('repoId') repoId: string) {
    await this.repos.link(
      await this.workspaceId(req),
      req.auth.user.id,
      parse(uuid, id),
      parse(uuid, repoId),
    )
  }

  @Delete('projects/:id/repositories/:repoId')
  @HttpCode(204)
  async unlink(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('repoId') repoId: string,
  ) {
    await this.repos.unlink(
      await this.workspaceId(req),
      req.auth.user.id,
      parse(uuid, id),
      parse(uuid, repoId),
    )
  }
}
