-- AlterTable
ALTER TABLE "DataSource" ADD COLUMN     "avgResponseTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "environment" TEXT NOT NULL DEFAULT 'development',
ADD COLUMN     "healthStatus" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastHealthCheck" TIMESTAMP(3),
ADD COLUMN     "poolConfig" JSONB,
ADD COLUMN     "queryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sslConfig" JSONB,
ADD COLUMN     "sslEnabled" BOOLEAN NOT NULL DEFAULT false;
