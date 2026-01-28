import { Module } from '@nestjs/common';
import { EmbeddingController } from './embedding.controller';
import { EmbeddingService } from './embedding.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [PrismaModule, LLMModule],
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
