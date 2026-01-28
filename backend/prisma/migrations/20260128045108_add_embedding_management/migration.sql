-- CreateEnum
CREATE TYPE "SearchMethod" AS ENUM ('DENSE', 'SPARSE', 'HYBRID');

-- CreateEnum
CREATE TYPE "EmbeddableType" AS ENUM ('TABLE', 'COLUMN', 'SAMPLE_QUERY', 'DOCUMENT', 'CUSTOM');

-- CreateTable
CREATE TABLE "EmbeddingConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "topK" INTEGER NOT NULL DEFAULT 10,
    "searchMethod" "SearchMethod" NOT NULL DEFAULT 'HYBRID',
    "denseWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "sparseWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "rrfK" INTEGER NOT NULL DEFAULT 60,
    "embeddingModel" TEXT,
    "dimensions" INTEGER NOT NULL DEFAULT 768,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dataSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbeddingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbeddableItem" (
    "id" TEXT NOT NULL,
    "type" "EmbeddableType" NOT NULL,
    "sourceId" TEXT,
    "content" TEXT NOT NULL,
    "contentHash" TEXT,
    "embedding" vector,
    "tokens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "dataSourceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastEmbeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbeddableItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "searchMethod" "SearchMethod" NOT NULL,
    "topK" INTEGER NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "denseResults" JSONB,
    "sparseResults" JSONB,
    "finalResults" JSONB,
    "denseTimeMs" INTEGER,
    "sparseTimeMs" INTEGER,
    "totalTimeMs" INTEGER NOT NULL,
    "dataSourceId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingConfig_name_key" ON "EmbeddingConfig"("name");

-- CreateIndex
CREATE INDEX "EmbeddingConfig_dataSourceId_idx" ON "EmbeddingConfig"("dataSourceId");

-- CreateIndex
CREATE INDEX "EmbeddingConfig_isActive_idx" ON "EmbeddingConfig"("isActive");

-- CreateIndex
CREATE INDEX "EmbeddableItem_type_idx" ON "EmbeddableItem"("type");

-- CreateIndex
CREATE INDEX "EmbeddableItem_sourceId_idx" ON "EmbeddableItem"("sourceId");

-- CreateIndex
CREATE INDEX "EmbeddableItem_dataSourceId_idx" ON "EmbeddableItem"("dataSourceId");

-- CreateIndex
CREATE INDEX "EmbeddableItem_isActive_idx" ON "EmbeddableItem"("isActive");

-- CreateIndex
CREATE INDEX "SearchLog_searchMethod_idx" ON "SearchLog"("searchMethod");

-- CreateIndex
CREATE INDEX "SearchLog_dataSourceId_idx" ON "SearchLog"("dataSourceId");

-- CreateIndex
CREATE INDEX "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");
