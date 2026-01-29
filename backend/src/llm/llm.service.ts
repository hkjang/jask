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
    // Use embedding-specific provider if available
    const provider = await this.getActiveEmbeddingProvider(providerId);

    // Priority: provider's embeddingModel > environment variable > chat model
    // This is crucial because many chat models (like codellama, qwen) do not support embeddings well or at all.
    const embeddingModel = provider.embeddingModel 
      || this.configService.get<string>('EMBEDDING_MODEL')
      || provider.model;
    
    // Use dedicated embedding baseUrl if available
    const embeddingBaseUrl = provider.embeddingBaseUrl || provider.baseUrl;
    
    const providerConfig = {
      baseUrl: embeddingBaseUrl,
      model: embeddingModel,
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
    } else if (provider.name === 'vllm') {
      yield* this.vllmProvider.generateStream(request, providerConfig);
    } else {
      // Fallback for unsupported providers: use non-streaming
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
      dbSpecificRules = '6. You MUST wrap all table and column names in DOUBLE QUOTES (e.g. "TableName", "ColumnName"). This is CRITICAL for PostgreSQL.\n7. Do NOT use Oracle functions like SYSDATE, NVL, DECODE. Use NOW() or CURRENT_TIMESTAMP, COALESCE, CASE WHEN instead.';
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
6. Avoid using complex proprietary functions like 'percentile_cont' or 'WITHIN GROUP' unless absolutely necessary. Prefer standard aggregates (AVG, MIN, MAX) or simple CTEs.
7. ${dbSpecificRules}

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

  async fixSQL(invalidSql: string, errorMessage: string, schemaContext: string, dbType: string = 'postgresql'): Promise<string> {
    let dbSpecificRules = '';
    if (dbType.toLowerCase().includes('postgres')) {
      dbSpecificRules = '\n6. CRITICAL: You MUST wrap ALL table and column names in DOUBLE QUOTES (e.g. "TableName", "columnName"). PostgreSQL is case-sensitive for unquoted identifiers.\n7. Do NOT use SYSDATE, NVL. Use NOW(), COALESCE.';
    } else if (dbType.toLowerCase().includes('mysql') || dbType.toLowerCase().includes('mariadb')) {
      dbSpecificRules = '\n6. You MUST wrap all table and column names in BACKTICKS (e.g. `TableName`, `ColumnName`).';
    } else if (dbType.toLowerCase().includes('oracle')) {
      dbSpecificRules = '\n6. For Oracle: Use VARCHAR2, NUMBER, DATE. Use FETCH FIRST N ROWS ONLY for limiting. Do NOT use information_schema.';
    }

    const systemPrompt = `You are an expert SQL debugger. The user has a query that failed to execute. Fix the SQL based on the error message.
    
Rules:
1. Return ONLY the fixed SQL query, no explanations.
2. Maintain the original intent of the query.
3. Fix syntax errors or logic issues mentioned in the error message.
4. Ensure compatibility with the database schema.
5. Do NOT use complex proprietary functions unless supported.${dbSpecificRules}

Database Schema:
${schemaContext}`;

    const response = await this.generate({
      prompt: `Failed SQL:\n${invalidSql}\n\nError Message:\n${errorMessage}\n\nPlease provide the corrected SQL.`,
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
6. diverse the topics.
7. Keep questions concise (under 100 characters each).`;

    const response = await this.generate({
      prompt: `Based on the following database schema, suggest ${count} complex analytical questions:\n\n${schemaContext}`,
      systemPrompt,
      temperature: 0.7,
      maxTokens: 3000,
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
      // JSON parsing failed, likely due to truncation using greedy regex to recover what we can
      this.logger.warn(`JSON parse failed, attempting regex recovery. Error: ${e.message}`);
      
      try {
        const content = response.content;
        const matches = [...content.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
        const questions = matches.map(m => m[1]);
        
        if (questions.length > 0) {
          // If we found questions, return them (up to the requested count or all found)
           return questions.filter(q => q.trim().length > 0);
        }
      } catch (recoveryError) {
        this.logger.error(`Failed to recover questions via regex: ${recoveryError.message}`);
      }
      
      this.logger.error(`Failed to parse recommended questions: ${e.message}. Content preview: ${response.content.substring(0, 500)}`);
      return [];
    }
  }

  getSampleQueryPrompts(): { systemPrompt: string } {
    return {
      systemPrompt: `You are an expert Data Engineer and SQL Architect. Your goal is to generate {count} high-quality "Natural Language Question" and "SQL Query" pairs based on the given database schema.

Rules:
1. **Questions MUST be in Korean.**
2. **SQL MUST be syntactically correct** for the given schema. Use proper table/column names from the schema.
3. **Variety**: Generate a mix of simple (filtering), medium (aggregation), and complex (JOINs, subqueries) queries.
4. **Format**: Return ONLY a valid JSON array of objects. No markdown, no explanations outside the JSON.
   Example format:
   [
     {
       "naturalQuery": "지난 달 가입한 사용자 수는?",
       "sqlQuery": "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 month'",
       "description": "최근 1개월 간 가입한 사용자 수 집계"
     }
   ]
5. **Context**: Use the provided schema to infer meaningful business questions.`
    };
  }

  async generateSampleQueryPairs(schemaContext: string, count: number = 5): Promise<{ naturalQuery: string; sqlQuery: string; description: string }[]> {
    const { systemPrompt } = this.getSampleQueryPrompts();
    // Replace placeholder with actual count
    const effectiveSystemPrompt = systemPrompt.replace('{count}', count.toString());

    const response = await this.generate({
      prompt: `Based on the following database schema, generate ${count} diverse and correct Question-SQL pairs:\n\n${schemaContext}`,
      systemPrompt: effectiveSystemPrompt,
      temperature: 0.7,
      maxTokens: 3000,
    });

    try {
      const content = response.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch (e) {
      this.logger.error(`Failed to parse generated sample queries: ${e.message}`);
      return [];
    }
  }

  async analyzeSqlMetadata(sql: string, schemaContext?: string): Promise<{ tables: string[]; columns: string[] }> {
    const systemPrompt = `You are an expert SQL Parser. Your goal is to extract all referenced "Table Names" and "Column Names" from the given SQL query.

Rules:
1. **Output Format**: JSON object with "tables" and "columns" arrays.
   Example: { "tables": ["users", "orders"], "columns": ["id", "email", "created_at"] }
2. **normalization**: precise names as they appear in the query (case-insensitive if SQL is standard, but respect quotes).
3. **No extra text**: Return ONLY the JSON.`;

    const response = await this.generate({
      prompt: `Analyze this SQL and extract table/column names:\n\n${sql}`,
      systemPrompt,
      temperature: 0.1,
      maxTokens: 1000,
    });

    try {
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      const parsed = JSON.parse(jsonStr);
      return {
        tables: Array.isArray(parsed.tables) ? parsed.tables : [],
        columns: Array.isArray(parsed.columns) ? parsed.columns : [],
      };
    } catch (e) {
      this.logger.warn(`Failed to analyze SQL metadata: ${e.message}`);
      return { tables: [], columns: [] };
    }
  }

  async generateChat(messages: { role: string; content: string }[], providerId?: string): Promise<LLMStreamChunk[]> {
    // 1. Construct prompt from messages
    let prompt = '';
    let systemPrompt = '';

    for (const msg of messages) {
      if (msg.role === 'system' || msg.role === 'SYSTEM') {
        systemPrompt += msg.content + '\n';
      } else if (msg.role === 'user' || msg.role === 'USER') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant' || msg.role === 'ASSISTANT') {
        prompt += `Assistant: ${msg.content}\n`;
      }
    }

    // Ensure the last part prompts the assistant
    if (!prompt.trim().endsWith('Assistant:')) {
      prompt += 'Assistant: ';
    }

    const request: LLMRequest = {
      prompt,
      systemPrompt: systemPrompt || undefined,
      temperature: 0.7,
    };

    // For now, return non-streamed response as chunks or stream if possible
    // Using generateStream internally
    const chunks: LLMStreamChunk[] = [];
    for await (const chunk of this.generateStream(request, providerId)) {
      chunks.push(chunk);
    }
    return chunks;
  }

  async testProviderConnection(provider: {
    name: string;
    baseUrl: string;
    model: string;
    apiKey?: string;
    config?: any;
  }): Promise<{ success: boolean; message: string; models?: string[] }> {
    const config = {
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: provider.apiKey ?? undefined,
      config: provider.config,
    };

    if (provider.name === 'ollama') {
      return this.ollamaProvider.testConnection(config);
    } else if (provider.name === 'vllm') {
      return this.vllmProvider.testConnection(config);
    }

    return { success: false, message: `지원하지 않는 프로바이더 타입: ${provider.name}` };
  }

  private async getActiveProvider(providerId?: string): Promise<{
    name: string;
    baseUrl: string;
    model: string;
    embeddingModel?: string | null;
    embeddingBaseUrl?: string | null;
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
      embeddingModel: this.configService.get<string>('EMBEDDING_MODEL') || undefined,
      embeddingBaseUrl: undefined,
      apiKey: undefined,
      config: {},
    };
  }

  private async getActiveEmbeddingProvider(providerId?: string): Promise<{
    name: string;
    baseUrl: string;
    model: string;
    embeddingModel?: string | null;
    embeddingBaseUrl?: string | null;
    apiKey?: string | null;
    config: any;
  }> {
    // If specific provider is requested, use it
    if (providerId) {
      const provider = await this.prisma.lLMProvider.findUnique({
        where: { id: providerId },
      });
      if (provider && provider.isActive) {
        return provider;
      }
    }

    // First, look for dedicated embedding provider (isEmbeddingDefault)
    const embeddingProvider = await this.prisma.lLMProvider.findFirst({
      where: { isEmbeddingDefault: true, isActive: true },
    });

    if (embeddingProvider) {
      return embeddingProvider;
    }

    // Fallback to default chat provider
    const defaultProvider = await this.prisma.lLMProvider.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (defaultProvider) {
      return defaultProvider;
    }

    // Fallback to environment config
    const defaultName = this.configService.get('DEFAULT_LLM_PROVIDER', 'ollama');
    return {
      name: defaultName,
      baseUrl: this.configService.get(
        defaultName === 'ollama' ? 'OLLAMA_BASE_URL' : 'VLLM_BASE_URL',
      ) || 'http://localhost:11434',
      model: this.configService.get(
        defaultName === 'ollama' ? 'OLLAMA_MODEL' : 'VLLM_MODEL',
      ) || 'codellama:7b',
      embeddingModel: this.configService.get<string>('EMBEDDING_MODEL') || undefined,
      embeddingBaseUrl: undefined,
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

    // SELECT or WITH로 시작하는 쿼리 찾기
    const sqlMatch = content.match(/(?:WITH|SELECT)[\s\S]+?(?:;|$)/i);
    if (sqlMatch) {
      return sqlMatch[0].replace(/;$/, '').trim();
    }

    return content.trim();
  }
}
