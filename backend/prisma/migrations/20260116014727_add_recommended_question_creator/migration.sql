-- AlterTable
ALTER TABLE "RecommendedQuestion" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'ADMIN';

-- CreateIndex
CREATE INDEX "RecommendedQuestion_createdById_idx" ON "RecommendedQuestion"("createdById");

-- CreateIndex
CREATE INDEX "RecommendedQuestion_source_idx" ON "RecommendedQuestion"("source");
