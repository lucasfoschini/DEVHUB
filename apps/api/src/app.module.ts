import { Module } from '@nestjs/common'
import { AuditService } from './audit/audit.service.js'
import { AUTH, createAuth } from './auth/auth.js'
import { SessionGuard } from './auth/session.guard.js'
import { loadEnv, type Env } from './env.js'
import { HealthController } from './health/health.controller.js'
import { PrismaService } from './prisma.service.js'
import { MeController } from './workspaces/me.controller.js'
import { WorkspacesService } from './workspaces/workspaces.service.js'

export const ENV = Symbol('ENV')

@Module({
  controllers: [HealthController, MeController],
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    {
      provide: PrismaService,
      inject: [ENV],
      useFactory: (env: Env) => new PrismaService(env.databaseUrl),
    },
    AuditService,
    {
      provide: AUTH,
      inject: [PrismaService, ENV, AuditService],
      useFactory: (prisma: PrismaService, env: Env, audit: AuditService) =>
        createAuth(prisma, env, (action, actorId) => audit.record({ action, actorId })),
    },
    SessionGuard,
    WorkspacesService,
  ],
})
export class AppModule {}
