-- CreateTable
CREATE TABLE "repository" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "private" BOOLEAN NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "defaultBranch" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "language" TEXT,
    "pushedAt" TIMESTAMP(3),
    "importedById" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_repository" (
    "projectId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_repository_pkey" PRIMARY KEY ("projectId","repositoryId")
);

-- CreateIndex
CREATE INDEX "repository_workspaceId_fullName_idx" ON "repository"("workspaceId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "repository_workspaceId_provider_externalId_key" ON "repository"("workspaceId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "project_repository_repositoryId_idx" ON "project_repository"("repositoryId");

-- AddForeignKey
ALTER TABLE "repository" ADD CONSTRAINT "repository_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repository" ADD CONSTRAINT "project_repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repository" ADD CONSTRAINT "project_repository_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
