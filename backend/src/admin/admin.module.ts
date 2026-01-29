import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { LLMModule } from '../llm/llm.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [PrismaModule, LLMModule, AuditModule, EmbeddingModule, AuthModule],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
