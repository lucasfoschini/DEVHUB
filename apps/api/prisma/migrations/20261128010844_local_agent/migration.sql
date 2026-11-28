-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'expired');

-- CreateTable
CREATE TABLE "device" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "folders" JSONB NOT NULL DEFAULT '[]',
    "pairedById" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_pairing" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_pairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_job" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "status" "AgentJobStatus" NOT NULL DEFAULT 'queued',
    "result" JSONB,
    "error" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "agent_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_secretHash_key" ON "device"("secretHash");

-- CreateIndex
CREATE INDEX "device_workspaceId_idx" ON "device"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "device_pairing_codeHash_key" ON "device_pairing"("codeHash");

-- CreateIndex
CREATE INDEX "agent_job_deviceId_status_createdAt_idx" ON "agent_job"("deviceId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "device" ADD CONSTRAINT "device_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_pairing" ADD CONSTRAINT "device_pairing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_job" ADD CONSTRAINT "agent_job_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
