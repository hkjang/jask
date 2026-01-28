import { Module, forwardRef } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { MetadataController } from './metadata.controller';
import { MetadataAiService } from './metadata-ai.service';
import { DataSourcesModule } from '../datasources/datasources.module';
import { LLMModule } from '../llm/llm.module';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [DataSourcesModule, LLMModule, forwardRef(() => EmbeddingModule)],
  providers: [MetadataService, MetadataAiService],
  controllers: [MetadataController],
  exports: [MetadataService, MetadataAiService],
})
export class MetadataModule {}

