-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('AUTH', 'DATA', 'ADMIN', 'SYSTEM', 'AI', 'QUERY', 'SECURITY');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditActionType" ADD VALUE 'AUTH_PASSWORD_CHANGE';
ALTER TYPE "AuditActionType" ADD VALUE 'AUTH_PASSWORD_RESET';
ALTER TYPE "AuditActionType" ADD VALUE 'PERMISSION_GRANT';
ALTER TYPE "AuditActionType" ADD VALUE 'PERMISSION_REVOKE';
ALTER TYPE "AuditActionType" ADD VALUE 'ROLE_CHANGE';
ALTER TYPE "AuditActionType" ADD VALUE 'USER_CREATE';
ALTER TYPE "AuditActionType" ADD VALUE 'USER_UPDATE';
ALTER TYPE "AuditActionType" ADD VALUE 'USER_DELETE';
ALTER TYPE "AuditActionType" ADD VALUE 'USER_ACTIVATE';
ALTER TYPE "AuditActionType" ADD VALUE 'USER_DEACTIVATE';
ALTER TYPE "AuditActionType" ADD VALUE 'SENSITIVE_DATA_ACCESS';
ALTER TYPE "AuditActionType" ADD VALUE 'BULK_DATA_ACCESS';
ALTER TYPE "AuditActionType" ADD VALUE 'DATA_IMPORT';
ALTER TYPE "AuditActionType" ADD VALUE 'SYSTEM_STARTUP';
ALTER TYPE "AuditActionType" ADD VALUE 'SYSTEM_SHUTDOWN';
ALTER TYPE "AuditActionType" ADD VALUE 'BACKUP_CREATE';
ALTER TYPE "AuditActionType" ADD VALUE 'BACKUP_RESTORE';
ALTER TYPE "AuditActionType" ADD VALUE 'API_KEY_CREATE';
ALTER TYPE "AuditActionType" ADD VALUE 'API_KEY_REVOKE';
ALTER TYPE "AuditActionType" ADD VALUE 'RATE_LIMIT_EXCEEDED';
ALTER TYPE "AuditActionType" ADD VALUE 'UNAUTHORIZED_ACCESS';
ALTER TYPE "AuditActionType" ADD VALUE 'SESSION_TIMEOUT';
ALTER TYPE "AuditActionType" ADD VALUE 'SESSION_HIJACK_ATTEMPT';
ALTER TYPE "AuditActionType" ADD VALUE 'CONCURRENT_LOGIN';
ALTER TYPE "AuditActionType" ADD VALUE 'SESSION_TERMINATED';
ALTER TYPE "AuditActionType" ADD VALUE 'DATASOURCE_CREATE';
ALTER TYPE "AuditActionType" ADD VALUE 'DATASOURCE_UPDATE';
ALTER TYPE "AuditActionType" ADD VALUE 'DATASOURCE_DELETE';
ALTER TYPE "AuditActionType" ADD VALUE 'METADATA_VIEW';
ALTER TYPE "AuditActionType" ADD VALUE 'METADATA_MODIFY';
ALTER TYPE "AuditActionType" ADD VALUE 'SCHEMA_SYNC';
ALTER TYPE "AuditActionType" ADD VALUE 'FAVORITE_CREATE';
ALTER TYPE "AuditActionType" ADD VALUE 'FAVORITE_DELETE';
ALTER TYPE "AuditActionType" ADD VALUE 'AI_QUERY_GENERATE';
ALTER TYPE "AuditActionType" ADD VALUE 'AI_MODEL_CHANGE';
ALTER TYPE "AuditActionType" ADD VALUE 'AI_PROMPT_MODIFY';
ALTER TYPE "AuditActionType" ADD VALUE 'DESTRUCTIVE_REJECT';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "apiEndpoint" TEXT,
ADD COLUMN     "category" "AuditCategory" NOT NULL DEFAULT 'QUERY',
ADD COLUMN     "clientInfo" JSONB,
ADD COLUMN     "geoInfo" JSONB,
ADD COLUMN     "httpMethod" TEXT,
ADD COLUMN     "newValue" JSONB,
ADD COLUMN     "previousValue" JSONB,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sessionId" TEXT;

-- CreateTable
CREATE TABLE "AuditSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "clientInfo" JSONB,
    "geoInfo" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityCount" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "terminatedReason" TEXT,

    CONSTRAINT "AuditSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAlert" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "auditLogId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "ipAddress" TEXT,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditSession_userId_idx" ON "AuditSession"("userId");

-- CreateIndex
CREATE INDEX "AuditSession_startedAt_idx" ON "AuditSession"("startedAt");

-- CreateIndex
CREATE INDEX "AuditSession_isActive_idx" ON "AuditSession"("isActive");

-- CreateIndex
CREATE INDEX "AuditSession_riskScore_idx" ON "AuditSession"("riskScore");

-- CreateIndex
CREATE INDEX "SecurityAlert_alertType_idx" ON "SecurityAlert"("alertType");

-- CreateIndex
CREATE INDEX "SecurityAlert_status_idx" ON "SecurityAlert"("status");

-- CreateIndex
CREATE INDEX "SecurityAlert_severity_idx" ON "SecurityAlert"("severity");

-- CreateIndex
CREATE INDEX "SecurityAlert_userId_idx" ON "SecurityAlert"("userId");

-- CreateIndex
CREATE INDEX "SecurityAlert_createdAt_idx" ON "SecurityAlert"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_category_idx" ON "AuditLog"("category");

-- CreateIndex
CREATE INDEX "AuditLog_sessionId_idx" ON "AuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "AuditLog_riskScore_idx" ON "AuditLog"("riskScore");

-- CreateIndex
CREATE INDEX "AuditLog_ipAddress_idx" ON "AuditLog"("ipAddress");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuditSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAlert" ADD CONSTRAINT "SecurityAlert_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
