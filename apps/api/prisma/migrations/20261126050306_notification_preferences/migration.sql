-- AlterTable
ALTER TABLE "workspace" ADD COLUMN     "mutedNotificationKinds" TEXT[] DEFAULT ARRAY[]::TEXT[];
