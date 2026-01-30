-- AlterTable
ALTER TABLE "SampleQuery" ADD COLUMN     "analysis" JSONB,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "IndexMetadata" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "indexName" TEXT NOT NULL,
    "columnNames" TEXT[],
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "indexType" TEXT,
    "tablespaceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndexMetadata_tableId_idx" ON "IndexMetadata"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "IndexMetadata_tableId_indexName_key" ON "IndexMetadata"("tableId", "indexName");

-- AddForeignKey
ALTER TABLE "IndexMetadata" ADD CONSTRAINT "IndexMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
