import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { toNodeHandler } from 'better-auth/node'
import { AppModule, ENV } from './app.module.js'
import { AUTH, type Auth } from './auth/auth.js'
import type { Env } from './env.js'
import { requireSameOrigin } from './origin.js'

async function bootstrap() {
  // Body parsing is off so Better Auth reads the raw request; JSON parsing is re-enabled
  // after the auth handler is mounted.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })
  const env = app.get<Env>(ENV)
  const express = app.getHttpAdapter().getInstance()

  express.disable('x-powered-by')
  express.all('/api/auth/{*path}', toNodeHandler(app.get<Auth>(AUTH)))
  app.use('/api', requireSameOrigin(env.webOrigin))
  app.useBodyParser('json', { limit: '100kb' })
  app.setGlobalPrefix('api')
  app.enableShutdownHooks()

  // Loopback only until hosting and its proxy topology are decided (THREAT_MODEL.md).
  await app.listen(env.port, '127.0.0.1')
}

void bootstrap()
