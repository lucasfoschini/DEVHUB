import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

// Prisma 7 does not read .env by itself. CI passes DATABASE_URL in the environment instead.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Not env(): that throws when unset, and `prisma generate` in CI runs without a database.
  datasource: { url: process.env.DATABASE_URL ?? '' },
})
