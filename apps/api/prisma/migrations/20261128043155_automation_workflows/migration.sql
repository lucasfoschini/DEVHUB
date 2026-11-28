-- AlterTable
ALTER TABLE "automation" ADD COLUMN     "action" TEXT NOT NULL DEFAULT 'webhook',
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "intervalMinutes" INTEGER,
ADD COLUMN     "lastFiredAt" TIMESTAMP(3),
ADD COLUMN     "message" TEXT,
ALTER COLUMN "url" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "automation_trigger_enabled_idx" ON "automation"("trigger", "enabled");
