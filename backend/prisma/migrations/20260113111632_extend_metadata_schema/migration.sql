-- CreateEnum
CREATE TYPE "ImportanceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SensitivityLevel" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'STRICT');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('FK', 'LOGICAL');

-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('PENDING', 'VALIDATING', 'EXECUTING', 'SUCCESS', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "Feedback" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PromptType" AS ENUM ('NL2SQL', 'SQL_EXPLAIN', 'SQL_FIX', 'RESULT_SUMMARY');

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "database" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "schema" TEXT DEFAULT 'public',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableMetadata" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "description" TEXT,
    "rowCount" INTEGER,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importanceLevel" "ImportanceLevel" NOT NULL DEFAULT 'MEDIUM',
    "isSyncedWithAI" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColumnMetadata" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "description" TEXT,
    "semanticName" TEXT,
    "unit" TEXT,
    "isCode" BOOLEAN NOT NULL DEFAULT false,
    "sensitivityLevel" "SensitivityLevel" NOT NULL DEFAULT 'INTERNAL',
    "isPrimaryKey" BOOLEAN NOT NULL DEFAULT false,
    "isForeignKey" BOOLEAN NOT NULL DEFAULT false,
    "referencedTable" TEXT,
    "referencedColumn" TEXT,
    "isNullable" BOOLEAN NOT NULL DEFAULT true,
    "codeValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColumnMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeValue" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableRelationship" (
    "id" TEXT NOT NULL,
    "sourceTableId" TEXT NOT NULL,
    "targetTableId" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL DEFAULT 'LOGICAL',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryHistory" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "naturalQuery" TEXT NOT NULL,
    "generatedSql" TEXT NOT NULL,
    "finalSql" TEXT,
    "sqlExplanation" TEXT,
    "status" "QueryStatus" NOT NULL DEFAULT 'PENDING',
    "executionTime" INTEGER,
    "rowCount" INTEGER,
    "errorMessage" TEXT,
    "feedback" "Feedback",
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleQuery" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "naturalQuery" TEXT NOT NULL,
    "sqlQuery" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "naturalQuery" TEXT NOT NULL,
    "sqlQuery" TEXT NOT NULL,
    "dataSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavoriteQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "apiKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LLMProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PromptType" NOT NULL,
    "content" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableMetadata_dataSourceId_idx" ON "TableMetadata"("dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TableMetadata_dataSourceId_schemaName_tableName_key" ON "TableMetadata"("dataSourceId", "schemaName", "tableName");

-- CreateIndex
CREATE INDEX "ColumnMetadata_tableId_idx" ON "ColumnMetadata"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "ColumnMetadata_tableId_columnName_key" ON "ColumnMetadata"("tableId", "columnName");

-- CreateIndex
CREATE INDEX "CodeValue_columnId_idx" ON "CodeValue"("columnId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeValue_columnId_code_key" ON "CodeValue"("columnId", "code");

-- CreateIndex
CREATE INDEX "TableRelationship_sourceTableId_idx" ON "TableRelationship"("sourceTableId");

-- CreateIndex
CREATE INDEX "TableRelationship_targetTableId_idx" ON "TableRelationship"("targetTableId");

-- CreateIndex
CREATE INDEX "QueryHistory_userId_idx" ON "QueryHistory"("userId");

-- CreateIndex
CREATE INDEX "QueryHistory_dataSourceId_idx" ON "QueryHistory"("dataSourceId");

-- CreateIndex
CREATE INDEX "QueryHistory_createdAt_idx" ON "QueryHistory"("createdAt");

-- CreateIndex
CREATE INDEX "SampleQuery_dataSourceId_idx" ON "SampleQuery"("dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "FavoriteQuery_userId_idx" ON "FavoriteQuery"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "LLMProvider_name_key" ON "LLMProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_name_key" ON "PromptTemplate"("name");

-- AddForeignKey
ALTER TABLE "TableMetadata" ADD CONSTRAINT "TableMetadata_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColumnMetadata" ADD CONSTRAINT "ColumnMetadata_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeValue" ADD CONSTRAINT "CodeValue_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "ColumnMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableRelationship" ADD CONSTRAINT "TableRelationship_sourceTableId_fkey" FOREIGN KEY ("sourceTableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableRelationship" ADD CONSTRAINT "TableRelationship_targetTableId_fkey" FOREIGN KEY ("targetTableId") REFERENCES "TableMetadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryHistory" ADD CONSTRAINT "QueryHistory_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryHistory" ADD CONSTRAINT "QueryHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleQuery" ADD CONSTRAINT "SampleQuery_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteQuery" ADD CONSTRAINT "FavoriteQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
