-- CreateEnum
CREATE TYPE "MonitorState" AS ENUM ('unknown', 'up', 'down');

-- CreateTable
CREATE TABLE "monitor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "state" "MonitorState" NOT NULL DEFAULT 'unknown',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_check" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "latencyMs" INTEGER,
    "error" TEXT,

    CONSTRAINT "monitor_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitor_enabled_nextCheckAt_idx" ON "monitor"("enabled", "nextCheckAt");

-- CreateIndex
CREATE INDEX "monitor_projectId_idx" ON "monitor"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "monitor_workspaceId_name_key" ON "monitor"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "monitor_check_monitorId_checkedAt_idx" ON "monitor_check"("monitorId", "checkedAt");

-- CreateIndex
CREATE INDEX "monitor_check_checkedAt_idx" ON "monitor_check"("checkedAt");

-- CreateIndex
CREATE INDEX "incident_workspaceId_openedAt_idx" ON "incident"("workspaceId", "openedAt");

-- CreateIndex
CREATE INDEX "incident_monitorId_resolvedAt_idx" ON "incident"("monitorId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "monitor" ADD CONSTRAINT "monitor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor" ADD CONSTRAINT "monitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_check" ADD CONSTRAINT "monitor_check_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
