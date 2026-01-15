import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DataSourcesModule } from './datasources/datasources.module';
import { MetadataModule } from './metadata/metadata.module';
import { NL2SQLModule } from './nl2sql/nl2sql.module';
import { ValidationModule } from './validation/validation.module';
import { ExecutionModule } from './execution/execution.module';
import { LLMModule } from './llm/llm.module';
import { QueryModule } from './query/query.module';
import { AdminModule } from './admin/admin.module';
import { EvolutionModule } from './evolution/evolution.module';
import { ThreadModule } from './thread/thread.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    DataSourcesModule,
    MetadataModule,
    NL2SQLModule,
    ValidationModule,
    ExecutionModule,
    LLMModule,
    QueryModule,
    AdminModule,
    EvolutionModule,
    ThreadModule,
    AuditModule,
  ],
})
export class AppModule {}
