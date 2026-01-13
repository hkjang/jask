import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { OllamaProvider } from './providers/ollama.provider';
import { VLLMProvider } from './providers/vllm.provider';

@Module({
  providers: [LLMService, OllamaProvider, VLLMProvider],
  exports: [LLMService],
})
export class LLMModule {}
