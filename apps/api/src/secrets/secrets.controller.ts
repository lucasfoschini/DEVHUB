import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js'
import { parse } from '../validation.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import { createSecret, listSecrets, updateSecret } from './secrets.schema.js'
import { SecretsService } from './secrets.service.js'

const id = z.uuid()

@Controller('secrets')
@UseGuards(SessionGuard)
export class SecretsController {
  constructor(
    private readonly secrets: SecretsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  private async workspaceId(req: AuthedRequest) {
    return (await this.workspaces.personal(req.auth.user.id)).id
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Query() query: unknown) {
    const { projectId } = parse(listSecrets, query)
    return this.secrets.list(await this.workspaceId(req), projectId)
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const data = parse(createSecret, body)
    return this.secrets.create(await this.workspaceId(req), req.auth.user.id, data)
  }

  @Patch(':id')
  async update(@Req() req: AuthedRequest, @Param('id') raw: string, @Body() body: unknown) {
    const data = parse(updateSecret, body)
    const ws = await this.workspaceId(req)
    return this.secrets.update(ws, req.auth.user.id, parse(id, raw), data)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') raw: string) {
    await this.secrets.remove(await this.workspaceId(req), req.auth.user.id, parse(id, raw))
  }

  @Post(':id/reveal')
  @HttpCode(200)
  async reveal(@Req() req: AuthedRequest, @Param('id') raw: string) {
    return this.secrets.reveal(await this.workspaceId(req), req.auth.user.id, parse(id, raw))
  }
}
