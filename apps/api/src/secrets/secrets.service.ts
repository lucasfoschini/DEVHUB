import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { z } from 'zod'
import { AuditService } from '../audit/audit.service.js'
import { ENV_TOKEN } from '../env-token.js'
import type { Env } from '../env.js'
import { decrypt, encrypt } from '../integrations/crypto.js'
import { PrismaService } from '../prisma.service.js'
import { assertProject } from '../projects/assert-project.js'
import { MAX_SECRETS, type createSecret, type updateSecret } from './secrets.schema.js'

/** Never selects encryptedValue: lists and mutations return metadata only. */
const PUBLIC = {
  id: true,
  projectId: true,
  name: true,
  environment: true,
  description: true,
  lastRevealedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
} as const

@Injectable()
export class SecretsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV_TOKEN) private readonly env: Env,
  ) {}

  private get key() {
    if (!this.env.encryptionKey) throw new ServiceUnavailableException('ENCRYPTION_KEY not set')
    return this.env.encryptionKey
  }

  list(workspaceId: string, projectId?: string) {
    return this.prisma.secret.findMany({
      where: { workspaceId, projectId },
      orderBy: [{ name: 'asc' }, { environment: 'asc' }],
      select: PUBLIC,
    })
  }

  private async find(workspaceId: string, id: string) {
    const secret = await this.prisma.secret.findFirst({ where: { id, workspaceId } })
    if (!secret) throw new NotFoundException()
    return secret
  }

  async create(workspaceId: string, actorId: string, data: z.output<typeof createSecret>) {
    const key = this.key
    await assertProject(this.prisma, workspaceId, data.projectId)
    if ((await this.prisma.secret.count({ where: { workspaceId } })) >= MAX_SECRETS) {
      throw new UnprocessableEntityException(`Limit of ${MAX_SECRETS} secrets reached`)
    }
    const { value, ...meta } = data
    try {
      const secret = await this.prisma.secret.create({
        data: { ...meta, workspaceId, createdById: actorId, encryptedValue: encrypt(value, key) },
        select: PUBLIC,
      })
      await this.record('secret.create', workspaceId, actorId, secret.id, secret.name)
      return secret
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('This name already exists in this environment')
      }
      throw e
    }
  }

  async update(
    workspaceId: string,
    actorId: string,
    id: string,
    data: z.output<typeof updateSecret>,
  ) {
    const existing = await this.find(workspaceId, id)
    const secret = await this.prisma.secret.update({
      where: { id },
      data: {
        description: data.description,
        ...(data.value === undefined ? {} : { encryptedValue: encrypt(data.value, this.key) }),
      },
      select: PUBLIC,
    })
    const action = data.value === undefined ? 'secret.update' : 'secret.rotate'
    await this.record(action, workspaceId, actorId, id, existing.name)
    return secret
  }

  async remove(workspaceId: string, actorId: string, id: string) {
    const existing = await this.find(workspaceId, id)
    await this.prisma.secret.delete({ where: { id } })
    await this.record('secret.delete', workspaceId, actorId, id, existing.name)
  }

  /** The only path that returns a plaintext value. Always audited. */
  async reveal(workspaceId: string, actorId: string, id: string) {
    const existing = await this.find(workspaceId, id)
    const value = decrypt(existing.encryptedValue, this.key)
    await this.prisma.secret.update({ where: { id }, data: { lastRevealedAt: new Date() } })
    await this.record('secret.reveal', workspaceId, actorId, id, existing.name)
    return { value }
  }

  private record(action: string, workspaceId: string, actorId: string, id: string, name: string) {
    // The name is metadata; the value never reaches the audit log.
    return this.audit.record({
      action,
      workspaceId,
      actorId,
      targetType: 'secret',
      targetId: id,
      metadata: { name },
    })
  }
}
