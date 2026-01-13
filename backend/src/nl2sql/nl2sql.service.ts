import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetadataService } from '../metadata/metadata.service';
import { LLMService } from '../llm/llm.service';
import { ValidationService, ValidationResult } from '../validation/validation.service';
import { ExecutionService, ExecutionResult } from '../execution/execution.service';
import { QueryStatus, RiskLevel, PolicyType } from '@prisma/client';

export interface NL2SQLRequest {
  dataSourceId: string;
  question: string;
  userId: string;
  autoExecute?: boolean;
}

export interface NL2SQLResponse {
  queryId: string;
  question: string;
  generatedSql: string;
  validation: ValidationResult;
  explanation?: string;
  result?: ExecutionResult;
  summary?: string;
  status: QueryStatus;
}

@Injectable()
export class NL2SQLService {
  private readonly logger = new Logger(NL2SQLService.name);

  constructor(
    private prisma: PrismaService,
    private metadataService: MetadataService,
    private llmService: LLMService,
    private validationService: ValidationService,
    private executionService: ExecutionService,
  ) {}

  async *generateAndExecuteStream(request: NL2SQLRequest): AsyncGenerator<any> {
    const { dataSourceId, question, userId, autoExecute } = request;

    yield { type: 'step_start', step: 'schema', message: '스키마 컨텍스트 조회 (Vector Search) 중...' };
    // Use Vector Search for scalable schema retrieval
    const schemaContext = await this.metadataService.searchSchemaContext(dataSourceId, question);
    if (!schemaContext || schemaContext.trim() === '') {
      throw new BadRequestException('데이터소스의 메타데이터를 먼저 동기화해주세요.');
    }

    // Fetch DataSource to determine type
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
    });
    const dbType = dataSource?.type || 'postgresql';
    
    let dbSpecificRules = '';
    if (dbType.toLowerCase().includes('postgres')) {
      dbSpecificRules = '6. You MUST wrap all table and column names in DOUBLE QUOTES (e.g. "TableName", "ColumnName"). This is CRITICAL for PostgreSQL.';
    } else if (dbType.toLowerCase().includes('mysql') || dbType.toLowerCase().includes('mariadb')) {
      dbSpecificRules = '6. You MUST wrap all table and column names in BACKTICKS (e.g. `TableName`, `ColumnName`).';
    }

    const queryHistory = await this.prisma.queryHistory.create({
      data: {
        dataSourceId,
        userId,
        naturalQuery: question,
        generatedSql: '',
        status: QueryStatus.PENDING,
      },
    });
    yield { type: 'history_created', queryId: queryHistory.id };

    let generatedSql = '';
    let tokens = { prompt: 0, completion: 0, total: 0 };

    try {
      // 3. SQL 생성 (Streaming)
      yield { type: 'step_start', step: 'sql_generation', message: 'SQL 생성 중...' };
      
      const sqlSystemPrompt = `You are an expert SQL query generator. Generate only valid SQL queries based on the user's natural language question and the provided database schema.
Rules:
1. Only generate SELECT queries
2. Never use DELETE, UPDATE, INSERT, DROP, TRUNCATE, ALTER
3. Always include LIMIT clause (max 1000)
4. Return ONLY the SQL query, no explanations
${dbSpecificRules}
Database Schema:
${schemaContext}`;

      const sqlStream = this.llmService.generateStream({
        prompt: question,
        systemPrompt: sqlSystemPrompt,
        temperature: 0.1,
        maxTokens: 2048,
      });

      for await (const chunk of sqlStream) {
        if (chunk.type === 'content') {
          generatedSql += chunk.content;
          yield { type: 'content_chunk', step: 'sql_generation', content: chunk.content };
        } else if (chunk.type === 'usage' && chunk.usage) {
          tokens.prompt += chunk.usage.promptTokens;
          tokens.completion += chunk.usage.completionTokens;
          tokens.total += chunk.usage.totalTokens;
          yield { type: 'token_usage', step: 'sql_generation', usage: chunk.usage };
        }
      }

      generatedSql = this.llmService['extractSQL'](generatedSql); // Access private method or refactor to public. Assuming extractSQL logic is needed.
      // Since extractSQL is private, I should replicate it or make it public. 
      // For now I'll implement simple cleanup here locally or cast to any.
      generatedSql = generatedSql.replace(/```sql\n?([\s\S]*?)\n?```/i, '$1').replace(/```\n?([\s\S]*?)\n?```/, '$1').trim();
      const selectMatch = generatedSql.match(/SELECT[\s\S]+?(?:;|$)/i);
      if (selectMatch) generatedSql = selectMatch[0].replace(/;$/, '').trim();

      // 4. SQL 검증 & 정책 검사 & 리스크 분석
      yield { type: 'step_start', step: 'validation', message: 'SQL 검증 및 분석 중...' };
      const validation = this.validationService.validate(generatedSql);
      
      const risk = this.analyzeRisk(generatedSql);
      const trustScore = this.calculateTrustScore(generatedSql);
      const policyCheck = await this.checkGovernance(generatedSql, userId);

      let status = validation.isValid ? QueryStatus.VALIDATING : QueryStatus.BLOCKED;
      if (!policyCheck.allowed) {
          status = QueryStatus.BLOCKED;
          validation.isValid = false;
          validation.errors.push(policyCheck.reason!);
      }
      
      await this.prisma.queryHistory.update({
        where: { id: queryHistory.id },
        data: { 
            generatedSql, 
            status,
            trustScore,
            riskLevel: risk.level
        },
      });

      if (!validation.isValid) {
        yield { type: 'error', message: 'SQL 검증 실패', details: validation.errors };
        return;
      }

      // 5. SQL 설명 생성 (Streaming)
      yield { type: 'step_start', step: 'explanation', message: 'SQL 설명 생성 중...' };
      let explanation = '';
      const explainSystemPrompt = `You are an SQL expert. Explain the given SQL query in simple Korean language.
Database Schema:
${schemaContext}`;

      const explainStream = this.llmService.generateStream({
        prompt: `다음 SQL 쿼리를 설명해주세요:\n\n${generatedSql}`,
        systemPrompt: explainSystemPrompt,
        temperature: 0.3,
      });

      for await (const chunk of explainStream) {
        if (chunk.type === 'content') {
          explanation += chunk.content;
          yield { type: 'content_chunk', step: 'explanation', content: chunk.content };
        } else if (chunk.type === 'usage' && chunk.usage) {
          tokens.prompt += chunk.usage.promptTokens;
          tokens.completion += chunk.usage.completionTokens;
          tokens.total += chunk.usage.totalTokens;
          yield { type: 'token_usage', step: 'explanation', usage: chunk.usage };
        }
      }

      await this.prisma.queryHistory.update({
        where: { id: queryHistory.id },
        data: { sqlExplanation: explanation },
      });

      yield { type: 'total_usage', usage: tokens };

      // 6. 자동 실행 (옵션)
      if (autoExecute) {
        yield { type: 'step_start', step: 'execution', message: 'SQL 실행 중...' };
        try {
          const result = await this.executionService.execute(
            dataSourceId,
            validation.sanitizedSql || generatedSql,
            { mode: 'execute' }
          );

          await this.prisma.queryHistory.update({
            where: { id: queryHistory.id },
            data: {
              finalSql: validation.sanitizedSql,
              status: QueryStatus.SUCCESS,
              executionTime: result.executionTime,
              rowCount: result.rowCount,
            },
          });

          yield { type: 'execution_result', result };
        } catch (error) {
          await this.prisma.queryHistory.update({
            where: { id: queryHistory.id },
            data: { status: QueryStatus.FAILED, errorMessage: error.message },
          });
          yield { type: 'error', message: `실행 실패: ${error.message}` };
        }
      } else {
         yield { 
            type: 'done', 
            queryId: queryHistory.id, 
            sql: generatedSql,
            trustScore,
            riskLevel: risk.level
         };
      }
      
      yield { 
         type: 'done', 
         queryId: queryHistory.id, 
         sql: generatedSql,
            trustScore,
            riskLevel: risk.level
      };

    } catch (error) {
      this.logger.error(`NL2SQL Stream failed: ${error.message}`);
      await this.prisma.queryHistory.update({
        where: { id: queryHistory.id },
        data: { status: QueryStatus.FAILED, errorMessage: error.message },
      });
      yield { type: 'error', message: error.message };
    }
  }

  async generateAndExecute(request: NL2SQLRequest): Promise<NL2SQLResponse> {
    const { dataSourceId, question, userId, autoExecute = false } = request;

    // 1. 스키마 컨텍스트 조회
    const schemaContext = await this.metadataService.getSchemaContext(dataSourceId);
    if (!schemaContext || schemaContext.trim() === '') {
      throw new BadRequestException('데이터소스의 메타데이터를 먼저 동기화해주세요.');
    }

    // Fetch DataSource to determine type
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
    });
    const dbType = dataSource?.type || 'postgresql';

    // 2. 쿼리 히스토리 생성
    const queryHistory = await this.prisma.queryHistory.create({
      data: {
        dataSourceId,
        userId,
        naturalQuery: question,
        generatedSql: '',
        status: QueryStatus.PENDING,
      },
    });

    try {
      // 3. SQL 생성
      this.logger.log(`Generating SQL for: ${question} with DB Type: ${dbType}`);
      const generatedSql = await this.llmService.generateSQL(question, schemaContext, dbType);

      // 4. SQL 검증 & 분석
      const validation = this.validationService.validate(generatedSql);
      
      const risk = this.analyzeRisk(generatedSql);
      const trustScore = this.calculateTrustScore(generatedSql);
      const policyCheck = await this.checkGovernance(generatedSql, userId);

      let status: QueryStatus = validation.isValid ? QueryStatus.VALIDATING : QueryStatus.BLOCKED;
      if (!policyCheck.allowed) {
         status = QueryStatus.BLOCKED;
         validation.isValid = false;
         validation.errors.push(policyCheck.reason!);
      }

      // 히스토리 업데이트
      await this.prisma.queryHistory.update({
        where: { id: queryHistory.id },
        data: {
          generatedSql,
          status,
          trustScore,
          riskLevel: risk.level
        },
      });

      if (!validation.isValid) {
        return {
          queryId: queryHistory.id,
          question,
          generatedSql,
          validation,
          status: QueryStatus.BLOCKED,
        };
      }

      // 5. SQL 설명 생성
      const explanation = await this.llmService.explainSQL(
        validation.sanitizedSql || generatedSql,
        schemaContext,
      );

      await this.prisma.queryHistory.update({
        where: { id: queryHistory.id },
        data: { sqlExplanation: explanation },
      });

      // 6. 자동 실행 (옵션)
      let result: ExecutionResult | undefined;
      let summary: string | undefined;
      // status field is already defined above
      // status field is already defined above

      if (autoExecute) {
        try {
          result = await this.executionService.execute(
            dataSourceId,
            validation.sanitizedSql || generatedSql,
            { mode: 'execute' },
          );

          status = QueryStatus.SUCCESS;

          // 결과 요약 생성
          if (result.rows.length > 0) {
            summary = await this.llmService.summarizeResults(
              validation.sanitizedSql || generatedSql,
              result.rows,
              question,
            );
          }

          await this.prisma.queryHistory.update({
            where: { id: queryHistory.id },
            data: {
              finalSql: validation.sanitizedSql,
              status: QueryStatus.SUCCESS,
              executionTime: result.executionTime,
              rowCount: result.rowCount,
            },
          });
        } catch (error) {
          status = QueryStatus.FAILED;
          await this.prisma.queryHistory.update({
            where: { id: queryHistory.id },
            data: {
              status: QueryStatus.FAILED,
              errorMessage: error.message,
            },
          });
        }
      }

      return {
        queryId: queryHistory.id,
        question,
        generatedSql: validation.sanitizedSql || generatedSql,
        validation,
        explanation,
        result,
        summary,
        status,
      };
    } catch (error) {
      this.logger.error(`NL2SQL failed: ${error.message}`);

      await this.prisma.queryHistory.update({
        where: { id: queryHistory.id },
        data: {
          status: QueryStatus.FAILED,
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  async executeQuery(
    queryId: string,
    sql?: string,
  ): Promise<{ result: ExecutionResult; summary?: string }> {
    const query = await this.prisma.queryHistory.findUnique({
      where: { id: queryId },
      include: { dataSource: true },
    });

    if (!query) {
      throw new BadRequestException('쿼리를 찾을 수 없습니다.');
    }

    const finalSql = sql || query.generatedSql;

    // 재검증
    const validation = this.validationService.validate(finalSql);
    if (!validation.isValid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    try {
      const result = await this.executionService.execute(
        query.dataSourceId,
        validation.sanitizedSql || finalSql,
        { mode: 'execute' },
      );

      let summary: string | undefined;
      if (result.rows.length > 0) {
        summary = await this.llmService.summarizeResults(
          validation.sanitizedSql || finalSql,
          result.rows,
          query.naturalQuery,
        );
      }

      await this.prisma.queryHistory.update({
        where: { id: queryId },
        data: {
          finalSql: validation.sanitizedSql || finalSql,
          status: QueryStatus.SUCCESS,
          executionTime: result.executionTime,
          rowCount: result.rowCount,
        },
      });

      return { result, summary };
    } catch (error) {
      await this.prisma.queryHistory.update({
        where: { id: queryId },
        data: {
          status: QueryStatus.FAILED,
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }

  async previewQuery(queryId: string, sql?: string): Promise<ExecutionResult> {
    const query = await this.prisma.queryHistory.findUnique({
      where: { id: queryId },
    });

    if (!query) {
      throw new BadRequestException('쿼리를 찾을 수 없습니다.');
    }

    const finalSql = sql || query.generatedSql;
    return this.executionService.preview(query.dataSourceId, finalSql);
  }

  async feedback(queryId: string, feedback: 'POSITIVE' | 'NEGATIVE', note?: string) {
    return this.prisma.queryHistory.update({
      where: { id: queryId },
      data: {
        feedback,
        feedbackNote: note,
      },
    });
  }

  async getRecommendedQuestions(dataSourceId: string): Promise<string[]> {
    const context = await this.metadataService.getReviewableSchemaContext(dataSourceId);
    if (!context) return [];
    
    return this.llmService.generateRecommendedQuestions(context, 4);
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  private analyzeRisk(sql: string): { level: RiskLevel; reasons: string[] } {
    const reasons: string[] = [];
    let level: RiskLevel = 'LOW' as RiskLevel;

    const upperSql = sql.toUpperCase();
    
    // Critical (DML is mostly handled by regex validation but valid to check here too)
    if (upperSql.match(/\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT|ALTER)\b/)) {
        return { level: 'CRITICAL' as RiskLevel, reasons: ['DML/DDL Operation detected'] };
    }

    // Complexity Checks
    const joinCount = (upperSql.match(/\bJOIN\b/g) || []).length;
    
    // High Risk
    if (joinCount > 4) {
        level = 'HIGH' as RiskLevel;
        reasons.push(`High Complexity (${joinCount} JOINs)`);
    }
    if (!upperSql.includes('LIMIT')) {
        // Only high if it's not an aggregation
        if (!upperSql.includes('COUNT(') && !upperSql.includes('SUM(')) {
             level = (level === 'LOW' || level === 'MEDIUM') ? 'HIGH' as RiskLevel : level;
             reasons.push('No LIMIT clause on non-aggregation query');
        }
    }

    // Medium Risk
    if (joinCount > 2 && joinCount <= 4) {
         if (level === 'LOW') level = 'MEDIUM' as RiskLevel;
    }

    return { level, reasons };
  }

  private calculateTrustScore(sql: string): number {
      let score = 1.0;
      const upperSql = sql.toUpperCase();
      
      const joinCount = (upperSql.match(/\bJOIN\b/g) || []).length;
      score -= (joinCount * 0.05); // -0.05 per join
      
      if (upperSql.includes('SELECT *')) score -= 0.15;
      
      // Bonus basics
      if (upperSql.includes('WHERE')) score += 0.05;
      if (upperSql.includes('LIMIT')) score += 0.05;

      // Cap
      return Math.min(1.0, Math.max(0.1, parseFloat(score.toFixed(2))));
  }

  private async checkGovernance(sql: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
      // Fetch active SQL policies
      // Using 'any' cast for PolicyType until generated
      const policies = await this.prisma['governancePolicy'].findMany({
          where: { isActive: true, type: 'SQL' },
          orderBy: { priority: 'desc' }
      });
      
      const upperSql = sql.toUpperCase();
      const joinCount = (upperSql.match(/\bJOIN\b/g) || []).length;

      for (const policy of policies) {
          const config = policy.config as any; 
          
          if (config.maxJoins && joinCount > config.maxJoins) {
              return { 
                  allowed: false, 
                  reason: `Policy Violation: Query exceeds max ${config.maxJoins} JOINs (Found: ${joinCount})` 
              };
          }
          
          if (config.forbiddenKeywords && Array.isArray(config.forbiddenKeywords)) {
               for (const word of config.forbiddenKeywords) {
                   if (upperSql.includes(word.toUpperCase())) {
                       return { allowed: false, reason: `Policy Violation: Forbidden keyword '${word}' used` };
                   }
               }
          }
      }
      
      return { allowed: true };
  }
}
