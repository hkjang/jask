-- CreateEnum
CREATE TYPE "PolicyArea" AS ENUM ('UX', 'AI', 'PERFORMANCE', 'SECURITY', 'OPERATION');

-- CreateEnum
CREATE TYPE "ExecutionMethod" AS ENUM ('IMMEDIATE', 'PHASED', 'AB_TEST', 'ROLLBACK_ENABLED');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('DDL_CREATE', 'DDL_ALTER', 'DDL_DROP', 'DDL_TRUNCATE', 'DML_INSERT', 'DML_UPDATE', 'DML_DELETE', 'QUERY_EXECUTE', 'AUTH_LOGIN', 'AUTH_LOGOUT', 'AUTH_FAILED', 'CONFIG_CHANGE', 'DATA_EXPORT', 'DESTRUCTIVE_CONFIRM');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'DANGER', 'CRITICAL');

-- AlterTable
ALTER TABLE "FavoriteQuery" ADD COLUMN     "description" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "useCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FavoriteFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavoriteFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyTrigger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAdjustmentRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" "PolicyArea" NOT NULL,
    "targetParameter" TEXT NOT NULL,
    "adjustmentValue" JSONB NOT NULL,
    "method" "ExecutionMethod" NOT NULL DEFAULT 'IMMEDIATE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyAdjustmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAdjustmentLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "previousValue" JSONB NOT NULL,
    "newValue" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" TIMESTAMP(3),

    CONSTRAINT "PolicyAdjustmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actionType" "AuditActionType" NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "description" TEXT NOT NULL,
    "sqlQuery" TEXT,
    "tableName" TEXT,
    "affectedRows" INTEGER,
    "userId" TEXT,
    "userEmail" TEXT,
    "userName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "dataSourceId" TEXT,
    "dataSourceName" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "executionTime" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PolicyAdjustmentRuleToPolicyTrigger" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "FavoriteFolder_userId_idx" ON "FavoriteFolder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteFolder_userId_name_key" ON "FavoriteFolder"("userId", "name");

-- CreateIndex
CREATE INDEX "AuditLog_actionType_idx" ON "AuditLog"("actionType");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_dataSourceId_idx" ON "AuditLog"("dataSourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_success_idx" ON "AuditLog"("success");

-- CreateIndex
CREATE UNIQUE INDEX "_PolicyAdjustmentRuleToPolicyTrigger_AB_unique" ON "_PolicyAdjustmentRuleToPolicyTrigger"("A", "B");

-- CreateIndex
CREATE INDEX "_PolicyAdjustmentRuleToPolicyTrigger_B_index" ON "_PolicyAdjustmentRuleToPolicyTrigger"("B");

-- CreateIndex
CREATE INDEX "FavoriteQuery_folderId_idx" ON "FavoriteQuery"("folderId");

-- CreateIndex
CREATE INDEX "FavoriteQuery_useCount_idx" ON "FavoriteQuery"("useCount");

-- AddForeignKey
ALTER TABLE "FavoriteQuery" ADD CONSTRAINT "FavoriteQuery_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FavoriteFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteFolder" ADD CONSTRAINT "FavoriteFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAdjustmentLog" ADD CONSTRAINT "PolicyAdjustmentLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PolicyAdjustmentRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PolicyAdjustmentRuleToPolicyTrigger" ADD CONSTRAINT "_PolicyAdjustmentRuleToPolicyTrigger_A_fkey" FOREIGN KEY ("A") REFERENCES "PolicyAdjustmentRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PolicyAdjustmentRuleToPolicyTrigger" ADD CONSTRAINT "_PolicyAdjustmentRuleToPolicyTrigger_B_fkey" FOREIGN KEY ("B") REFERENCES "PolicyTrigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
