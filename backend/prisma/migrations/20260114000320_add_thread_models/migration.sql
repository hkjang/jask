-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('QUERY', 'SQL', 'METADATA', 'MODEL', 'DOMAIN');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MetadataStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('QUERY', 'EDIT', 'EXECUTE', 'RE_ASK', 'RATE', 'SAVE', 'ABANDON');

-- CreateEnum
CREATE TYPE "CandidateType" AS ENUM ('PROMPT', 'METADATA', 'MODEL_ROUTING');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- AlterTable
ALTER TABLE "QueryHistory" ADD COLUMN     "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "trustScore" DOUBLE PRECISION,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "SampleQuery" ADD COLUMN     "embedding" vector;

-- AlterTable
ALTER TABLE "TableMetadata" ADD COLUMN     "completenessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lastAiUpdate" TIMESTAMP(3),
ADD COLUMN     "metadataStatus" "MetadataStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "reviewNotes" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "department" TEXT,
ADD COLUMN     "preferences" JSONB;

-- CreateTable
CREATE TABLE "SchemaEmbedding" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemaEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernancePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PolicyType" NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryComment" (
    "id" TEXT NOT NULL,
    "queryHistoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueryComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryShare" (
    "id" TEXT NOT NULL,
    "queryHistoryId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "sharedToUserId" TEXT,
    "sharedToTeam" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "queryId" TEXT,
    "actionType" "ActionType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionSignal" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "dataset" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvolutionSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionCandidate" (
    "id" TEXT NOT NULL,
    "type" "CandidateType" NOT NULL,
    "targetId" TEXT,
    "proposedChange" JSONB NOT NULL,
    "reasoning" TEXT NOT NULL,
    "impactAnalysis" JSONB,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "approverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "EvolutionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "ThreadStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "queryId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadMeta" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "contextSummary" TEXT,
    "topicTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreadMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "lastAccess" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchemaEmbedding_tableId_key" ON "SchemaEmbedding"("tableId");

-- CreateIndex
CREATE INDEX "SchemaEmbedding_tableId_idx" ON "SchemaEmbedding"("tableId");

-- CreateIndex
CREATE INDEX "QueryComment_queryHistoryId_idx" ON "QueryComment"("queryHistoryId");

-- CreateIndex
CREATE INDEX "QueryShare_queryHistoryId_idx" ON "QueryShare"("queryHistoryId");

-- CreateIndex
CREATE INDEX "QueryShare_sharedToUserId_idx" ON "QueryShare"("sharedToUserId");

-- CreateIndex
CREATE INDEX "UserActionLog_userId_idx" ON "UserActionLog"("userId");

-- CreateIndex
CREATE INDEX "UserActionLog_actionType_idx" ON "UserActionLog"("actionType");

-- CreateIndex
CREATE INDEX "UserActionLog_createdAt_idx" ON "UserActionLog"("createdAt");

-- CreateIndex
CREATE INDEX "EvolutionSignal_targetId_idx" ON "EvolutionSignal"("targetId");

-- CreateIndex
CREATE INDEX "EvolutionSignal_signalType_idx" ON "EvolutionSignal"("signalType");

-- CreateIndex
CREATE INDEX "EvolutionCandidate_status_idx" ON "EvolutionCandidate"("status");

-- CreateIndex
CREATE INDEX "EvolutionCandidate_type_idx" ON "EvolutionCandidate"("type");

-- CreateIndex
CREATE INDEX "Thread_ownerId_idx" ON "Thread"("ownerId");

-- CreateIndex
CREATE INDEX "Thread_updatedAt_idx" ON "Thread"("updatedAt");

-- CreateIndex
CREATE INDEX "Message_threadId_idx" ON "Message"("threadId");

-- CreateIndex
CREATE INDEX "Message_timestamp_idx" ON "Message"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadMeta_threadId_key" ON "ThreadMeta"("threadId");

-- CreateIndex
CREATE INDEX "UserThread_userId_idx" ON "UserThread"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserThread_userId_threadId_key" ON "UserThread"("userId", "threadId");

-- AddForeignKey
ALTER TABLE "SchemaEmbedding" ADD CONSTRAINT "SchemaEmbedding_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryComment" ADD CONSTRAINT "QueryComment_queryHistoryId_fkey" FOREIGN KEY ("queryHistoryId") REFERENCES "QueryHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryComment" ADD CONSTRAINT "QueryComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryShare" ADD CONSTRAINT "QueryShare_queryHistoryId_fkey" FOREIGN KEY ("queryHistoryId") REFERENCES "QueryHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryShare" ADD CONSTRAINT "QueryShare_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActionLog" ADD CONSTRAINT "UserActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActionLog" ADD CONSTRAINT "UserActionLog_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "QueryHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "QueryHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadMeta" ADD CONSTRAINT "ThreadMeta_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserThread" ADD CONSTRAINT "UserThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserThread" ADD CONSTRAINT "UserThread_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
