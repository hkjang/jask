-- CreateEnum
CREATE TYPE "DataSourceRole" AS ENUM ('VIEWER', 'EDITOR', 'ADMIN');

-- CreateTable
CREATE TABLE "DataSourceAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "role" "DataSourceRole" NOT NULL DEFAULT 'VIEWER',
    "grantedById" TEXT,
    "grantedByName" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSourceAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataSourceAccess_userId_idx" ON "DataSourceAccess"("userId");

-- CreateIndex
CREATE INDEX "DataSourceAccess_dataSourceId_idx" ON "DataSourceAccess"("dataSourceId");

-- CreateIndex
CREATE INDEX "DataSourceAccess_role_idx" ON "DataSourceAccess"("role");

-- CreateIndex
CREATE INDEX "DataSourceAccess_expiresAt_idx" ON "DataSourceAccess"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataSourceAccess_userId_dataSourceId_key" ON "DataSourceAccess"("userId", "dataSourceId");

-- AddForeignKey
ALTER TABLE "DataSourceAccess" ADD CONSTRAINT "DataSourceAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSourceAccess" ADD CONSTRAINT "DataSourceAccess_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
