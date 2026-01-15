-- AlterTable
ALTER TABLE "TableMetadata" ADD COLUMN     "tableType" TEXT NOT NULL DEFAULT 'TABLE',
ADD COLUMN     "viewDefinition" TEXT;
