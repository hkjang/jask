import { Module } from '@nestjs/common';
import { NL2SQLService } from './nl2sql.service';
import { NL2SQLController } from './nl2sql.controller';
import { MetadataModule } from '../metadata/metadata.module';
import { LLMModule } from '../llm/llm.module';
import { ValidationModule } from '../validation/validation.module';
import { ExecutionModule } from '../execution/execution.module';

import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [MetadataModule, LLMModule, ValidationModule, ExecutionModule, EmbeddingModule],
  providers: [NL2SQLService],
  controllers: [NL2SQLController],
  exports: [NL2SQLService],
})
export class NL2SQLModule {}
