import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import { createProject, listProjects, projectId, updateProject } from './projects.schema.js'
import { ProjectsService } from './projects.service.js'

@Controller('projects')
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    return this.projects.list(await this.workspaceId(req), parse(listProjects, query))
  }

  @Get(':id')
  async get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.projects.get(await this.workspaceId(req), parse(projectId, id))
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(createProject, body)
    return this.projects.create(await this.workspaceId(req), req.auth.user.id, data)
  }

  @Patch(':id')
  async update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    const data = parse(updateProject, body)
    return this.projects.update(
      await this.workspaceId(req),
      req.auth.user.id,
      parse(projectId, id),
      data,
    )
  }
}
