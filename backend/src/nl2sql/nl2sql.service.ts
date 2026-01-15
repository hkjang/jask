import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetadataService } from '../metadata/metadata.service';
import { LLMService } from '../llm/llm.service';
import { ValidationService, ValidationResult } from '../validation/validation.service';
import { ExecutionService, ExecutionResult } from '../execution/execution.service';
import { QueryStatus, RiskLevel } from '@prisma/client';

export interface NL2SQLRequest {
  dataSourceId: string;
  question: string;
  userId: string;
  autoExecute?: boolean;
  threadId?: string;
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
    const { dataSourceId, question, userId, autoExecute, threadId } = request;

    yield { type: 'step_start', step: 'schema', message: '스키마 컨텍스트 조회 (Vector Search) 중...' };
    
    // Fetch DataSource to determine type first
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
    });
    const dbType = dataSource?.type || 'postgresql';

    // Check if DDL is allowed
    const sqlSettings = await this.prisma.systemSettings.findMany({
      where: { key: { in: ['sql_allow_ddl', 'sql_allow_writes'] } }
    });
    const allowDDL = sqlSettings.find(s => s.key === 'sql_allow_ddl')?.value === true;
    
    // Use Vector Search for scalable schema retrieval
    let schemaContext = await this.metadataService.searchSchemaContext(dataSourceId, question);
    
    // If schema is empty but DDL is allowed, provide minimal context for DDL queries
    if (!schemaContext || schemaContext.trim() === '') {
      if (allowDDL) {
        // Provide minimal context for DDL operations
        schemaContext = `Database: ${dataSource?.database || 'unknown'}
Schema: ${dataSource?.schema || 'default'}
Type: ${dbType}
Note: This database currently has no tables. You can create new tables.`;
        yield { type: 'step_info', message: '테이블이 없는 빈 데이터베이스입니다. DDL 명령으로 테이블을 생성할 수 있습니다.' };
      } else {
        throw new BadRequestException('데이터소스의 메타데이터를 먼저 동기화해주세요.');
      }
    }
    
    let dbSpecificRules = '';
    if (dbType.toLowerCase().includes('postgres')) {
      dbSpecificRules = '6. You MUST wrap ALL table and column names in DOUBLE QUOTES (e.g. "TableName", "rowCount", "userId"). PostgreSQL is case-sensitive for mixed-case identifiers. Do NOT use unquoted camelCase.';
    } else if (dbType.toLowerCase().includes('oracle')) {
      dbSpecificRules = `6. For Oracle database:
- Use VARCHAR2 instead of VARCHAR
- Use NUMBER instead of INT/INTEGER  
- Use CLOB instead of TEXT
- Use DATE or TIMESTAMP for dates
- Use SYSDATE for current timestamp
- Table and column names should be UPPERCASE or wrapped in double quotes`;
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

    let promptWithHistory = question;
    if (threadId) {
      const thread = await this.prisma.thread.findUnique({
        where: { id: threadId },
        include: { messages: { orderBy: { timestamp: 'desc' }, take: 5 } },
      });

      if (thread) {
        // Reverse to get chronological order
        const history = [...thread.messages].reverse().map(m => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
        promptWithHistory = `Conversation History:\n${history}\n\nCurrent Question: ${question}`;
      }
    }

    let generatedSql = '';
    let explanation = '';
    let tokens = { prompt: 0, completion: 0, total: 0 };

    try {
      // 3. SQL 생성 (Streaming)
      yield { type: 'step_start', step: 'sql_generation', message: 'SQL 생성 중...' };
      
    // Fetch SQL settings for DDL/DML permission
    const sqlSettings = await this.prisma.systemSettings.findMany({
      where: { key: { in: ['sql_allow_ddl', 'sql_allow_writes'] } }
    });
    const allowDDL = sqlSettings.find(s => s.key === 'sql_allow_ddl')?.value === true;
    const allowWrites = sqlSettings.find(s => s.key === 'sql_allow_writes')?.value === true;

    let sqlRules = '';
    if (allowDDL && allowWrites) {
      sqlRules = `1. You can generate SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER statements
2. For table creation, use appropriate syntax for the database type (Oracle uses VARCHAR2, NUMBER, DATE, etc.)`;
    } else if (allowDDL) {
      sqlRules = `1. You can generate SELECT, CREATE, ALTER statements
2. Do NOT generate INSERT, UPDATE, DELETE statements
3. For table creation, use appropriate syntax for the database type`;
    } else if (allowWrites) {
      sqlRules = `1. You can generate SELECT, INSERT, UPDATE, DELETE statements
2. Do NOT generate CREATE, ALTER, DROP statements`;
    } else {
      sqlRules = `1. Only generate SELECT queries
2. Never use DELETE, UPDATE, INSERT, DROP, TRUNCATE, ALTER, CREATE`;
    }

    const sqlSystemPrompt = `You are an expert SQL query generator. Generate only valid SQL queries based on the user's natural language question and the provided database schema.
Rules:
${sqlRules}
3. Always include LIMIT clause for SELECT queries (max 1000)
4. Return ONLY the SQL query, no explanations
5. If the question refers to previous context, use the conversation history to infer the correct query.
${dbSpecificRules}

For Oracle database specifically:
- Use VARCHAR2 instead of VARCHAR
- Use NUMBER instead of INT/INTEGER
- Use CLOB instead of TEXT
- Use appropriate Oracle date functions (SYSDATE, TO_DATE, etc.)
- Use sequences or identity columns for auto-increment
- NEVER use LIMIT clause - Oracle does not support it
- For row limiting, use: FETCH FIRST N ROWS ONLY (Oracle 12c+) or WHERE ROWNUM <= N
- For table list queries, use: SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = 'SCHEMA_NAME'
- For column info, use: SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'TABLE_NAME'
- Oracle system views: ALL_TABLES, ALL_TAB_COLUMNS, ALL_CONSTRAINTS (NOT information_schema)
- Oracle does NOT have information_schema - never use it

Database Schema:
${schemaContext}`;

      const sqlStream = this.llmService.generateStream({
        prompt: promptWithHistory,
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

      generatedSql = generatedSql.replace(/```sql\n?([\s\S]*?)\n?```/i, '$1').replace(/```\n?([\s\S]*?)\n?```/, '$1').trim();
      const selectMatch = generatedSql.match(/SELECT[\s\S]+?(?:;|$)/i);
      if (selectMatch) generatedSql = selectMatch[0].replace(/;$/, '').trim();

      // 4. SQL 검증 & 정책 검사 & 리스크 분석
      yield { type: 'step_start', step: 'validation', message: 'SQL 검증 및 분석 중...' };
      const validation = this.validationService.validate(generatedSql);
      
      const risk = this.analyzeRisk(generatedSql);
      let trustScore = this.calculateTrustScore(generatedSql);
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
      
      // Save assistant response to Thread (if valid)
      if (threadId && validation.isValid) {
           await this.prisma.message.create({
               data: {
                   threadId,
                   role: 'ASSISTANT',
                   content: `### SQL Generated\n\`\`\`sql\n${generatedSql}\n\`\`\`\n\n### Explanation\n${explanation}`,
                   queryId: queryHistory.id
               }
           });
           
           await this.prisma.thread.update({
             where: { id: threadId },
             data: { updatedAt: new Date() }
           });
      }

      // 6. 자동 실행 (옵션 or 정책)
      let shouldExecute = autoExecute;
      
      // Policy Check
      if (!shouldExecute) {
           const settings = await this.prisma.systemSettings.findMany({ 
               where: { key: { in: ['auto_execute_enabled', 'confirm_threshold'] } } 
           });
           const autoExecPolicy = settings.find(s => s.key === 'auto_execute_enabled')?.value === true;
           const threshold = Number(settings.find(s => s.key === 'confirm_threshold')?.value || 80);
           
           if (autoExecPolicy && (trustScore * 100) >= threshold) {
               this.logger.log(`Policy triggered Auto-Execution (Trust: ${trustScore*100} >= ${threshold})`);
               shouldExecute = true;
               yield { type: 'policy_log', message: '신뢰도 기준 충족으로 자동 실행됩니다.' };
           }
      }

      if (shouldExecute) {
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
              trustScore: 1.0, // Proven by execution
            },
          });
          
          // trustScore is local here, assuming it was defined as 'let' or we update the yielded object directly
          // We need to ensure 'trustScore' variable is mutable.
          // However, looking at the code flow, trustScore was defined at line 293 (in generateAndExecute) or 136 (in stream).
          // If it's 'generateAndExecuteStream', it's defined at line 136. I will check line 136 separately.
          // For now, I will fix the 'where' clause here and assume I need to fix variable declaration in another chunk if needed.
          // Wait, the error said "Cannot assign to 'trustScore' because it is a constant".
          // So I must find where trustScore is defined and change it to let.
          
          trustScore = 1.0; // Update local for stream output

          yield { type: 'execution_result', result };
        } catch (error) {
          // Auto-correction attempt
          this.logger.warn(`Execution failed, attempting auto-fix. Error: ${error.message}`);
          yield { type: 'step_start', step: 'auto_fix', message: 'SQL 실행 오류 발생, 자동 수정 시도 중...' };
          
          try {
              const fixedSql = await this.llmService.fixSQL(validation.sanitizedSql || generatedSql, error.message, schemaContext);
              this.logger.log(`Auto-fixed SQL: ${fixedSql}`);
              
              const retryResult = await this.executionService.execute(
                dataSourceId,
                fixedSql,
                { mode: 'execute' }
              );

              // Update with fixed SQL
              await this.prisma.queryHistory.update({
                where: { id: queryHistory.id },
                data: {
                  finalSql: fixedSql,
                  status: QueryStatus.SUCCESS,
                  executionTime: retryResult.executionTime,
                  rowCount: retryResult.rowCount,
                  trustScore: 1.0, // Proven by execution
                },
              });
              
              trustScore = 1.0;
              generatedSql = fixedSql; // Update local for final output
              
              // Update Chat Message content if exists
              const message = await this.prisma.message.findFirst({
                  where: { queryId: queryHistory.id }
              });
              
              if (message) {
                  const newContent = message.content.replace(/```sql[\s\S]*?```/, `\`\`\`sql\n${fixedSql}\n\`\`\``) + 
                                     `\n\n> **알림:** 초기 쿼리 실행이 실패하여, 자동으로 수정된 쿼리로 재실행되었습니다.`;
                  
                  await this.prisma.message.update({
                      where: { id: message.id },
                      data: { content: newContent }
                  });
              }

              yield { type: 'execution_result', result: retryResult };
              yield { type: 'step_start', step: 'auto_fix_success', message: 'SQL 자동 수정 및 실행 성공!' };

          } catch (retryError) {
              await this.prisma.queryHistory.update({
                where: { id: queryHistory.id },
                data: { status: QueryStatus.FAILED, errorMessage: error.message }, // Keep original error if fix fails
              });
              yield { type: 'error', message: `실행 실패: ${error.message}` };
          }
        }
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
    const { dataSourceId, question, userId, autoExecute = false, threadId } = request;

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
      let trustScore = this.calculateTrustScore(generatedSql);
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

      // 6. 자동 실행 (옵션 or 정책)
      let result: ExecutionResult | undefined;
      let summary: string | undefined;
      let shouldExecute = autoExecute;

      if (!shouldExecute) {
           const settings = await this.prisma.systemSettings.findMany({ 
               where: { key: { in: ['auto_execute_enabled', 'confirm_threshold'] } } 
           });
           const autoExecPolicy = settings.find(s => s.key === 'auto_execute_enabled')?.value === true;
           const threshold = Number(settings.find(s => s.key === 'confirm_threshold')?.value || 80);
           
           if (autoExecPolicy && (trustScore * 100) >= threshold) {
               shouldExecute = true;
           }
      }

      if (shouldExecute) {
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
              trustScore: 1.0, // Proven by execution
            },
          });
          
          trustScore = 1.0;
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
  ): Promise<{ result: ExecutionResult; summary?: string; finalSql?: string }> {
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
      // if (result.rows.length > 0) {
      //   summary = await this.llmService.summarizeResults(
      //     validation.sanitizedSql || finalSql,
      //     result.rows,
      //     query.naturalQuery,
      //   );
      // }

      await this.prisma.queryHistory.update({
        where: { id: queryId },
        data: {
          finalSql: validation.sanitizedSql || finalSql,
          status: QueryStatus.SUCCESS,
          executionTime: result.executionTime,
          rowCount: result.rowCount,
          trustScore: 1.0, // Proven by execution
        },
      });

      return { result, summary, finalSql: validation.sanitizedSql || finalSql };
    } catch (error) {
      // Auto-correction attempt for re-execution
      try {
        const schemaContext = await this.metadataService.getSchemaContext(query.dataSourceId);
        if (schemaContext) {
           const fixedSql = await this.llmService.fixSQL(validation.sanitizedSql || finalSql, error.message, schemaContext);
           
           const retryResult = await this.executionService.execute(
            query.dataSourceId,
            fixedSql,
            { mode: 'execute' }
           );

           await this.prisma.queryHistory.update({
             where: { id: queryId },
             data: {
               finalSql: fixedSql,
               status: QueryStatus.SUCCESS,
               executionTime: retryResult.executionTime,
               rowCount: retryResult.rowCount,
               trustScore: 1.0, // Proven by execution
             },
           });

           // Update Chat Message content if exists
           const message = await this.prisma.message.findFirst({
               where: { queryId: queryId }
           });
           
           if (message) {
               const newContent = message.content.replace(/```sql[\s\S]*?```/, `\`\`\`sql\n${fixedSql}\n\`\`\``) + 
                                  `\n\n> **알림:** 초기 쿼리 실행이 실패하여, 자동으로 수정된 쿼리로 재실행되었습니다.`;
               
               await this.prisma.message.update({
                   where: { id: message.id },
                   data: { content: newContent }
               });
           }

           return { result: retryResult, summary: undefined, finalSql: fixedSql };
        }
      } catch (retryError) {
        // Fallthrough to fail
      }

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
      // Base score for generated SQL (before execution) is capped at 0.8
      // Execution success will boost it to 1.0
      let score = 0.8;
      const upperSql = sql.toUpperCase();
      
      // Removed JOIN penalties as complexity != incorrectness
      // const joinCount = (upperSql.match(/\bJOIN\b/g) || []).length;
      // score -= (joinCount * 0.05); 
      
      if (upperSql.includes('SELECT *')) score -= 0.15;
      
      // Bonus basics
      if (upperSql.includes('WHERE')) score += 0.05;
      if (upperSql.includes('LIMIT')) score += 0.05;

      // Cap
      return Math.min(0.9, Math.max(0.1, parseFloat(score.toFixed(2))));
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
