import { Module } from '@nestjs/common'
import { AgentController, AgentGuard, AgentService, DevicesController } from './agent/agent.js'
import { AuditService } from './audit/audit.service.js'
import { AUTH, createAuth } from './auth/auth.js'
import { SessionGuard } from './auth/session.guard.js'
import { ENV_TOKEN as ENV } from './env-token.js'
import { loadEnv, type Env } from './env.js'
import { HealthController } from './health/health.controller.js'
import { GithubService } from './integrations/github.service.js'
import { IntegrationsController } from './integrations/integrations.controller.js'
import { RepositoriesController } from './repositories/repositories.controller.js'
import { RepositoriesService } from './repositories/repositories.service.js'
import { MonitorsController } from './monitors/monitors.controller.js'
import { MonitorsService } from './monitors/monitors.service.js'
import { NotificationsController } from './notifications/notifications.controller.js'
import { NotificationsService } from './notifications/notifications.service.js'
import { OverviewController } from './overview/overview.controller.js'
import { OverviewService } from './overview/overview.service.js'
import { AnalyticsController, AnalyticsService } from './analytics/analytics.js'
import { AutomationsController, AutomationsService } from './automations/automations.js'
import { DeploymentsController, DeploymentsService } from './deployments/deployments.js'
import { NotesController, NotesService } from './notes/notes.js'
import { PromptsController, PromptsService } from './prompts/prompts.js'
import { SecretsController } from './secrets/secrets.controller.js'
import { SecretsService } from './secrets/secrets.service.js'
import { ServersController, ServersService } from './servers/servers.js'
import { PrismaService } from './prisma.service.js'
import { ProvidersController, ProvidersService } from './providers/providers.js'
import { ProjectsController } from './projects/projects.controller.js'
import { ProjectsService } from './projects/projects.service.js'
import { MeController } from './workspaces/me.controller.js'
import { WorkspacesService } from './workspaces/workspaces.service.js'

export { ENV }

@Module({
  controllers: [
    HealthController,
    MeController,
    ProjectsController,
    MonitorsController,
    IntegrationsController,
    RepositoriesController,
    NotificationsController,
    OverviewController,
    SecretsController,
    ServersController,
    NotesController,
    PromptsController,
    AutomationsController,
    DeploymentsController,
    AnalyticsController,
    ProvidersController,
    DevicesController,
    AgentController,
  ],
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
    ProjectsService,
    MonitorsService,
    GithubService,
    RepositoriesService,
    NotificationsService,
    OverviewService,
    SecretsService,
    ServersService,
    NotesService,
    PromptsService,
    AutomationsService,
    DeploymentsService,
    AnalyticsService,
    ProvidersService,
    AgentService,
    AgentGuard,
  ],
})
export class AppModule {}
