import { Injectable, Logger } from '@nestjs/common';
import { LLMRequest, LLMResponse } from '../llm.service';

interface OllamaApiResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

@Injectable()
export class OllamaProvider {
  private readonly logger = new Logger(OllamaProvider.name);

  async generate(
    request: LLMRequest,
    config: { baseUrl: string; model: string; config?: any },
  ): Promise<LLMResponse> {
    const url = `${config.baseUrl}/api/generate`;

    // 개발 모드: Ollama 없이 테스트할 수 있도록 Mock 응답
    const useMock = process.env.USE_MOCK_LLM === 'true';
    if (useMock) {
      this.logger.log('Mock LLM 모드 사용 중');
      const mockSQL = this.generateMockSQL(request.prompt);
      return {
        content: mockSQL,
        model: 'mock',
        provider: 'ollama-mock',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    const body = {
      model: config.model,
      prompt: request.systemPrompt
        ? `${request.systemPrompt}\n\nUser: ${request.prompt}\n\nAssistant:`
        : request.prompt,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.3,
        num_predict: request.maxTokens ?? 2048,
        ...config.config,
      },
    };

    try {
      // 600초 타임아웃 (10분)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 600000);

      this.logger.log(`Ollama 요청: ${config.model} at ${config.baseUrl}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: OllamaApiResponse = await response.json();
      this.logger.log(`Ollama 응답 완료: ${data.eval_count || 0} tokens`);

      return {
        content: data.response,
        model: data.model,
        provider: 'ollama',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };

    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.error('Ollama 요청 타임아웃 (600초)');
        throw new Error('LLM 요청 시간 초과. Ollama 서버가 실행 중인지 확인하세요.');
      }
      this.logger.error(`Ollama generation failed: ${error.message}`);
      throw new Error(`LLM 생성 실패: ${error.message}. Ollama 서버(${config.baseUrl})가 실행 중인지 확인하세요.`);
    }
  }

  async generateEmbedding(
    text: string,
    config: { baseUrl: string; model: string; config?: any },
  ): Promise<number[]> {
    const url = `${config.baseUrl}/api/embeddings`;
    
    // Use dedicated embedding model if configured, or fallback to main model (which might fail)
    // For now, assuming the user configures an embedding-capable model or we hardcode a default like 'nomic-embed-text' if the main model is chat-only?
    // Let's rely on the config passed in. 
    
    const body = {
      model: config.model, 
      prompt: text,
    };

    try {
      this.logger.log(`Ollama Embedding Request: ${config.model}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Embedding model '${config.model}' not found. Please run 'ollama pull ${config.model}' to install it. If it is already installed, try restarting the Ollama service.`);
        }
        throw new Error(`Ollama Embedding API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error: any) {
      this.logger.error(`Ollama embedding failed: ${error.message}`);
      throw new Error(`LLM 임베딩 생성 실패: ${error.message}`);
    }
  }

  // Helper to keep original logic if needed, but for now let's just add generateStream
  async *generateStream(
    request: LLMRequest,
    config: { baseUrl: string; model: string; config?: any },
  ): AsyncGenerator<any> {
    const url = `${config.baseUrl}/api/generate`;
    const useMock = process.env.USE_MOCK_LLM === 'true';

    if (useMock) {
      this.logger.log('Mock LLM Streaming Mode');
      const mockSQL = this.generateMockSQL(request.prompt);
      const chunks = mockSQL.split(' ');
      
      for (const chunk of chunks) {
        yield { type: 'content', content: chunk + ' ' };
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      
      yield { 
        type: 'usage', 
        usage: { promptTokens: 10, completionTokens: chunks.length, totalTokens: 10 + chunks.length } 
      };
      yield { type: 'done' };
      return;
    }

    const body = {
      model: config.model,
      prompt: request.systemPrompt
        ? `${request.systemPrompt}\n\nUser: ${request.prompt}\n\nAssistant:`
        : request.prompt,
      stream: true, // Enable streaming
      options: {
        temperature: request.temperature ?? 0.3,
        num_predict: request.maxTokens ?? 2048,
        ...config.config,
      },
    };

    try {
      this.logger.log(`Ollama Stream Request: ${config.model}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Ollama API Stream error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            if (!data.done) {
              if (data.response) {
                yield { type: 'content', content: data.response };
              }
            } else {
              this.logger.log(`Ollama Stream Done: ${data.eval_count} tokens`);
              yield {
                type: 'usage',
                usage: {
                  promptTokens: data.prompt_eval_count || 0,
                  completionTokens: data.eval_count || 0,
                  totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                },
              };
              yield { type: 'done' };
            }
          } catch (e) {
            console.warn('Error parsing JSON chunk', e);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Ollama stream failed: ${error.message}`);
      yield { type: 'error', error: error.message };
    }
  }




  async testConnection(
    config: { baseUrl: string; model: string; config?: any },
  ): Promise<{ success: boolean; message: string; models?: string[] }> {
    try {
      const url = `${config.baseUrl}/api/tags`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

      this.logger.log(`Ollama 연결 테스트: ${config.baseUrl}`);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];

      return {
        success: true,
        message: `Ollama 연결 성공. 모델 ${models.length}개 감지됨.`,
        models,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, message: '연결 시간 초과 (5초)' };
      }
      return { success: false, message: `연결 실패: ${error.message}` };
    }
  }

  private generateMockSQL(prompt: string): string {
    // 간단한 Mock SQL 생성 (개발 테스트용)
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
