-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('connected', 'needs_reconnect');

-- CreateTable
CREATE TABLE "integration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalLogin" TEXT NOT NULL,
    "scopes" TEXT[],
    "encryptedToken" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'connected',
    "connectedById" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_workspaceId_provider_key" ON "integration"("workspaceId", "provider");

-- AddForeignKey
ALTER TABLE "integration" ADD CONSTRAINT "integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
