import { Injectable, Logger } from '@nestjs/common';
import { LLMRequest, LLMResponse, LLMStreamChunk } from '../llm.service';

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
      reasoning_content?: string;
    };
    finish_reason: string;
    logprobs?: any;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface VLLMStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
    };
    finish_reason: string | null;
    logprobs?: any;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface VLLMErrorResponse {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
  detail?: string;
}

@Injectable()
export class VLLMProvider {
  private readonly logger = new Logger(VLLMProvider.name);
  private readonly DEFAULT_TIMEOUT_MS = 600000; // 600 seconds (10 minutes)

  async generate(
    request: LLMRequest,
    config: { baseUrl: string; model: string; apiKey?: string; config?: any },
  ): Promise<LLMResponse> {
    const url = `${config.baseUrl}/v1/chat/completions`;

    // Mock mode support for development
    const useMock = process.env.USE_MOCK_LLM === 'true';
    if (useMock) {
      this.logger.log('Mock vLLM 모드 사용 중');
      return this.generateMockResponse(request);
    }

    const messages = this.buildMessages(request);

    const body = {
      model: config.model,
      messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 2048,
      stream: false,
      ...config.config,
    };

    const headers = this.buildHeaders(config.apiKey);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT_MS);

      this.logger.log(`vLLM 요청: ${config.model} at ${config.baseUrl}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorMessage = await this.parseErrorResponse(response);
        throw new Error(`vLLM API error: ${response.status} ${response.statusText} - ${errorMessage}`);
      }

      const data: VLLMApiResponse = await response.json();

      this.logger.log(`vLLM 응답 완료: ${data.usage?.total_tokens || 0} tokens`);

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
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.error('vLLM 요청 타임아웃 (600초)');
        throw new Error('LLM 요청 시간 초과. vLLM 서버가 실행 중인지 확인하세요.');
      }
      this.logger.error(`vLLM generation failed: ${error.message}`);
      throw new Error(`LLM 생성 실패: ${error.message}. vLLM 서버(${config.baseUrl})가 실행 중인지 확인하세요.`);
    }
  }

  async *generateStream(
    request: LLMRequest,
    config: { baseUrl: string; model: string; apiKey?: string; config?: any },
  ): AsyncGenerator<LLMStreamChunk> {
    const url = `${config.baseUrl}/v1/chat/completions`;

    // Mock mode support
    const useMock = process.env.USE_MOCK_LLM === 'true';
    if (useMock) {
      this.logger.log('Mock vLLM Streaming Mode');
      yield* this.generateMockStream(request);
      return;
    }

    const messages = this.buildMessages(request);

    const body = {
      model: config.model,
      messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 2048,
      stream: true,
      stream_options: { include_usage: true }, // Request usage stats in stream
      ...config.config,
    };

    const headers = this.buildHeaders(config.apiKey);

    try {
      this.logger.log(`vLLM Stream Request: ${config.model} at ${config.baseUrl}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok || !response.body) {
        const errorMessage = await this.parseErrorResponse(response);
        throw new Error(`vLLM API Stream error: ${response.status} - ${errorMessage}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (!trimmedLine) continue;
          
          // Handle SSE format: data: {...}
          if (trimmedLine.startsWith('data:')) {
            const jsonStr = trimmedLine.slice(5).trim();
            
            // Check for stream end signal
            if (jsonStr === '[DONE]') {
              this.logger.log(`vLLM Stream Done: ${totalContent.length} chars`);
              yield { type: 'done' };
              return;
            }

            try {
              const data: VLLMStreamChunk = JSON.parse(jsonStr);

              // Extract content from delta
              const choice = data.choices?.[0];
              if (choice?.delta?.content) {
                totalContent += choice.delta.content;
                yield { type: 'content', content: choice.delta.content };
              }

              // Extract reasoning content if available (for inference models)
              if (choice?.delta?.reasoning_content) {
                yield { type: 'content', content: choice.delta.reasoning_content };
              }

              // Check for finish_reason
              if (choice?.finish_reason) {
                this.logger.log(`vLLM Stream finish_reason: ${choice.finish_reason}`);
              }

              // Extract usage if available (usually in the last chunk)
              if (data.usage) {
                yield {
                  type: 'usage',
                  usage: {
                    promptTokens: data.usage.prompt_tokens || 0,
                    completionTokens: data.usage.completion_tokens || 0,
                    totalTokens: data.usage.total_tokens || 0,
                  },
                };
              }
            } catch (e) {
              this.logger.warn(`Error parsing vLLM stream chunk: ${e}`);
            }
          }
        }
      }

      // Ensure we emit done if not already
      yield { type: 'done' };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.error('vLLM Stream 요청 타임아웃 (600초)');
        yield { type: 'error', error: 'LLM 요청 시간 초과. vLLM 서버가 실행 중인지 확인하세요.' };
      } else {
        this.logger.error(`vLLM stream failed: ${error.message}`);
        yield { type: 'error', error: error.message };
      }
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

    const headers = this.buildHeaders(config.apiKey);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT_MS);

      this.logger.log(`vLLM Embedding Request: ${config.model}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorMessage = await this.parseErrorResponse(response);
        
        if (response.status === 404) {
          throw new Error(`Embedding 모델 '${config.model}'을 찾을 수 없습니다. vLLM 서버에서 해당 모델이 로드되어 있는지 확인하세요.`);
        }
        
        throw new Error(`vLLM Embedding API error: ${response.status} - ${errorMessage}`);
      }

      const data = await response.json();
      
      if (!data.data?.[0]?.embedding) {
        throw new Error('vLLM Embedding 응답에 embedding 데이터가 없습니다.');
      }
      
      return data.data[0].embedding;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.error('vLLM Embedding 요청 타임아웃 (600초)');
        throw new Error('LLM 임베딩 요청 시간 초과. vLLM 서버가 실행 중인지 확인하세요.');
      }
      this.logger.error(`vLLM embedding failed: ${error.message}`);
      throw new Error(`LLM 임베딩 생성 실패: ${error.message}`);
    }
  }

  async testConnection(
    config: { baseUrl: string; model: string; apiKey?: string },
  ): Promise<{ success: boolean; message: string; models?: string[] }> {
    try {
      const headers = this.buildHeaders(config.apiKey);

      // Test by fetching available models
      const modelsUrl = `${config.baseUrl}/v1/models`;
      const response = await fetch(modelsUrl, { 
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorMessage = await this.parseErrorResponse(response);
        return {
          success: false,
          message: `vLLM 연결 실패: ${response.status} - ${errorMessage}`,
        };
      }

      const data = await response.json();
      const models = data.data?.map((m: any) => m.id) || [];

      return {
        success: true,
        message: `vLLM 서버 연결 성공. 사용 가능한 모델: ${models.length}개`,
        models,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `vLLM 연결 실패: ${error.message}`,
      };
    }
  }

  // Helper methods
  private buildMessages(request: LLMRequest): Array<{ role: string; content: string }> {
    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });
    return messages;
  }

  private buildHeaders(apiKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  private async parseErrorResponse(response: Response): Promise<string> {
    try {
      const errorData: VLLMErrorResponse = await response.json();
      
      if (errorData.error?.message) {
        return errorData.error.message;
      }
      if (errorData.detail) {
        return errorData.detail;
      }
      
      return response.statusText;
    } catch {
      const text = await response.text().catch(() => '');
      return text || response.statusText;
    }
  }

  private generateMockResponse(request: LLMRequest): LLMResponse {
    const mockSQL = this.generateMockSQL(request.prompt);
    return {
      content: mockSQL,
      model: 'mock-vllm',
      provider: 'vllm-mock',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  }

  private async *generateMockStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const mockSQL = this.generateMockSQL(request.prompt);
    const chunks = mockSQL.split(' ');

    for (const chunk of chunks) {
      yield { type: 'content', content: chunk + ' ' };
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    yield {
      type: 'usage',
      usage: { promptTokens: 10, completionTokens: chunks.length, totalTokens: 10 + chunks.length },
    };
    yield { type: 'done' };
  }

  private generateMockSQL(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('사용자') || lowerPrompt.includes('user')) {
      return 'SELECT id, email, name, role, "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 10';
    }
    if (lowerPrompt.includes('쿼리') || lowerPrompt.includes('query') || lowerPrompt.includes('이력')) {
      return 'SELECT id, "naturalQuery", status, "createdAt" FROM "QueryHistory" ORDER BY "createdAt" DESC LIMIT 10';
    }
    if (lowerPrompt.includes('데이터소스') || lowerPrompt.includes('datasource')) {
      return 'SELECT id, name, type, host, database, "isActive" FROM "DataSource" ORDER BY "createdAt" DESC LIMIT 10';
    }

    return 'SELECT 1 as mock_result, NOW() as generated_at';
  }
}
