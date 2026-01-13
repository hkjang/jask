import { Injectable, Logger } from '@nestjs/common';
import { LLMRequest, LLMResponse } from '../llm.service';

interface VLLMApiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class VLLMProvider {
  private readonly logger = new Logger(VLLMProvider.name);

  async generate(
    request: LLMRequest,
    config: { baseUrl: string; model: string; apiKey?: string; config?: any },
  ): Promise<LLMResponse> {
    const url = `${config.baseUrl}/v1/chat/completions`;

    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const body = {
      model: config.model,
      messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 2048,
      ...config.config,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`vLLM API error: ${response.status} ${response.statusText}`);
      }

      const data: VLLMApiResponse = await response.json();

      return {
        content: data.choices[0]?.message?.content || '',
        model: data.model,
        provider: 'vllm',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      this.logger.error(`vLLM generation failed: ${error.message}`);
      throw error;
    }
  }

  async generateEmbedding(
    text: string,
    config: { baseUrl: string; model: string; apiKey?: string; config?: any },
  ): Promise<number[]> {
    const url = `${config.baseUrl}/v1/embeddings`;

    const body = {
      model: config.model,
      input: text,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`vLLM Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      this.logger.error(`vLLM embedding failed: ${error.message}`);
      throw error;
    }
  }
}
