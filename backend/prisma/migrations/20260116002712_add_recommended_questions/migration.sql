-- AlterTable
ALTER TABLE "ColumnMetadata" ADD COLUMN     "isExcluded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RecommendedQuestion" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isAIGenerated" BOOLEAN NOT NULL DEFAULT false,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendedQuestion_dataSourceId_idx" ON "RecommendedQuestion"("dataSourceId");

-- CreateIndex
CREATE INDEX "RecommendedQuestion_isActive_idx" ON "RecommendedQuestion"("isActive");

-- AddForeignKey
ALTER TABLE "RecommendedQuestion" ADD CONSTRAINT "RecommendedQuestion_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
