-- Drop the old constraint and recreate with correct dimensions
ALTER TABLE "SchemaEmbedding" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "SchemaEmbedding" ADD COLUMN "embedding" vector(1024);
