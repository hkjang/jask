import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaProvider } from './providers/ollama.provider';
import { VLLMProvider } from './providers/vllm.provider';
import { PrismaService } from '../prisma/prisma.service';

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
export interface LLMStreamChunk {
  content?: string;
  type: 'content' | 'usage' | 'done' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  error?: string;
}

export interface LLMEmbeddingResponse {
  embedding: number[];
  usage?: {
    totalTokens: number;
  };
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private ollamaProvider: OllamaProvider,
    private vllmProvider: VLLMProvider,
  ) {}

  async generate(request: LLMRequest, providerId?: string): Promise<LLMResponse> {
    const provider = await this.getActiveProvider(providerId);
    const providerConfig = {
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: provider.apiKey ?? undefined,
      config: provider.config,
    };

    if (provider.name === 'ollama') {
      return this.ollamaProvider.generate(request, providerConfig);
    } else if (provider.name === 'vllm') {
      return this.vllmProvider.generate(request, providerConfig);
    }

    throw new Error(`지원하지 않는 LLM 프로바이더: ${provider.name}`);
  }

  async generateEmbedding(text: string, providerId?: string): Promise<number[]> {
    const provider = await this.getActiveProvider(providerId);

    // Allow overriding the model for embeddings via environment variable
    // This is crucial because many chat models (like codellama, qwen) do not support embeddings well or at all.
    const embeddingModel = this.configService.get<string>('EMBEDDING_MODEL');
    
    const providerConfig = {
      baseUrl: provider.baseUrl,
      model: embeddingModel || provider.model, // Use specific embedding model if set
      apiKey: provider.apiKey ?? undefined,
      config: provider.config,
    };

    if (provider.name === 'ollama') {
      return this.ollamaProvider.generateEmbedding(text, providerConfig);
    } else if (provider.name === 'vllm') {
      return this.vllmProvider.generateEmbedding(text, providerConfig);
    }

    throw new Error(`지원하지 않는 LLM 프로바이더: ${provider.name}`);
  }

  async *generateStream(request: LLMRequest, providerId?: string): AsyncGenerator<LLMStreamChunk> {
    const provider = await this.getActiveProvider(providerId);
    const providerConfig = {
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: provider.apiKey ?? undefined,
      config: provider.config,
    };

    if (provider.name === 'ollama') {
      yield* this.ollamaProvider.generateStream(request, providerConfig);
    } else {
      // Fallback for non-streaming providers (like VLLM for now)
      const response = await this.generate(request, providerId);
      yield { type: 'content', content: response.content };
      if (response.usage) {
        yield { type: 'usage', usage: response.usage };
      }
      yield { type: 'done' };
    }
  }

  async generateSQL(naturalQuery: string, schemaContext: string, dbType: string = 'postgresql'): Promise<string> {
    
    let dbSpecificRules = '';
    if (dbType.toLowerCase().includes('postgres')) {
      dbSpecificRules = '6. You MUST wrap all table and column names in DOUBLE QUOTES (e.g. "TableName", "ColumnName"). This is CRITICAL for PostgreSQL.';
    } else if (dbType.toLowerCase().includes('mysql') || dbType.toLowerCase().includes('mariadb')) {
      dbSpecificRules = '6. You MUST wrap all table and column names in BACKTICKS (e.g. `TableName`, `ColumnName`).';
    }

    const systemPrompt = `You are an expert SQL query generator. Generate only valid SQL queries based on the user's natural language question and the provided database schema.

Rules:
1. Only generate SELECT queries
2. Never use DELETE, UPDATE, INSERT, DROP, TRUNCATE, ALTER
3. Always include LIMIT clause (max 1000)
4. Use proper JOIN syntax when needed
5. Return ONLY the SQL query, no explanations
${dbSpecificRules}

Database Schema:
${schemaContext}`;

    const response = await this.generate({
      prompt: naturalQuery,
      systemPrompt,
      temperature: 0.1,
      maxTokens: 2048,
    });

    return this.extractSQL(response.content);
  }

  async explainSQL(sql: string, schemaContext: string): Promise<string> {
    const systemPrompt = `You are an SQL expert. Explain the given SQL query in simple Korean language.
Explain:
1. What data it retrieves
2. How tables are joined (if any)
3. What filters are applied
4. The expected result

Database Schema:
${schemaContext}`;

    const response = await this.generate({
      prompt: `다음 SQL 쿼리를 설명해주세요:\n\n${sql}`,
      systemPrompt,
      temperature: 0.3,
    });

    return response.content;
  }

  async summarizeResults(sql: string, results: any[], question: string): Promise<string> {
    const sampleData = JSON.stringify(results.slice(0, 10), null, 2);

    const systemPrompt = `You are a data analyst. Summarize the query results in Korean, answering the user's original question.
Be concise but informative. Highlight key findings and patterns.`;

    const response = await this.generate({
      prompt: `원래 질문: ${question}\n\nSQL 쿼리:\n${sql}\n\n결과 데이터 (샘플):\n${sampleData}\n\n총 ${results.length}개의 결과가 있습니다.`,
      systemPrompt,
      temperature: 0.5,
    });

    return response.content;
  }

  async generateRecommendedQuestions(schemaContext: string, count: number = 3): Promise<string[]> {
    const systemPrompt = `You are a Senior Data Analyst. Your goal is to suggest ${count} complex, insightful questions that a user might want to ask about the database.

Rules:
1. Questions MUST be in Korean.
2. Questions MUST require complex SQL operations (e.g., JOINs, Aggregations, Group By, Subqueries, or Time-series analysis).
3. Do NOT ask simple "List all..." questions.
4. Focus on business insights (e.g., trends, top performers, correlation).
5. Return ONLY a raw JSON array of strings, no markdown formatting. Example: ["question 1", "question 2"]
6. diverse the topics.`;

    const response = await this.generate({
      prompt: `Based on the following database schema, suggest ${count} complex analytical questions:\n\n${schemaContext}`,
      systemPrompt,
      temperature: 0.7,
      maxTokens: 1500,
    });

    try {
      // Improved JSON extraction using regex to find array
      const content = response.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch (e) {
      this.logger.error(`Failed to parse recommended questions: ${e.message}. Content preview: ${response.content.substring(0, 500)}`);
      return [];
    }
  }

  private async getActiveProvider(providerId?: string): Promise<{
    name: string;
    baseUrl: string;
    model: string;
    apiKey?: string | null;
    config: any;
  }> {
    if (providerId) {
      const provider = await this.prisma.lLMProvider.findUnique({
        where: { id: providerId },
      });
      if (provider && provider.isActive) {
        return provider;
      }
    }

    // 기본 프로바이더 찾기
    const defaultProvider = await this.prisma.lLMProvider.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (defaultProvider) {
      return defaultProvider;
    }

    // 설정 파일에서 기본값 사용
    const defaultName = this.configService.get('DEFAULT_LLM_PROVIDER', 'ollama');
    return {
      name: defaultName,
      baseUrl: this.configService.get(
        defaultName === 'ollama' ? 'OLLAMA_BASE_URL' : 'VLLM_BASE_URL',
      ) || 'http://localhost:11434',
      model: this.configService.get(
        defaultName === 'ollama' ? 'OLLAMA_MODEL' : 'VLLM_MODEL',
      ) || 'codellama:7b',
      apiKey: undefined,
      config: {},
    };
  }

  private extractSQL(content: string): string {
    // SQL 코드 블록 추출
    const codeBlockMatch = content.match(/```sql\n?([\s\S]*?)\n?```/i);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // 일반 코드 블록
    const generalBlockMatch = content.match(/```\n?([\s\S]*?)\n?```/);
    if (generalBlockMatch) {
      return generalBlockMatch[1].trim();
    }

    // SELECT로 시작하는 쿼리 찾기
    const selectMatch = content.match(/SELECT[\s\S]+?(?:;|$)/i);
    if (selectMatch) {
      return selectMatch[0].replace(/;$/, '').trim();
    }

    return content.trim();
  }
}
