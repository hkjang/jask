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
    let referencedTablesMarkdown = '';

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
    
    // Determine Top K limit from configuration
    let topK = 10;
    try {
      const activeConfig = await this.prisma.embeddingConfig.findFirst({
        where: { dataSourceId, isActive: true },
      }) || await this.prisma.embeddingConfig.findFirst({
        where: { dataSourceId: null, isActive: true },
      });
      if (activeConfig?.topK) topK = activeConfig.topK;
    } catch (e) { this.logger.warn(`Failed to fetch embedding config: ${e.message}`); }

    // Use Vector Search for scalable schema retrieval
    const schemaSearch = await this.metadataService.searchSchemaContext(dataSourceId, question, topK);
    let schemaContext = schemaSearch.context;

    if (schemaSearch.tables && schemaSearch.tables.length > 0) {
      this.logger.log(`[Schema Search] Selected tables: ${schemaSearch.tables.join(', ')}`);
      yield { type: 'context_selected', tables: schemaSearch.tables };
      
      // Persist in message content for history
      const tableLinks = schemaSearch.tables.map(t => `[${t}](table:${t})`).join(', ');
      referencedTablesMarkdown = `**참조 테이블**: ${tableLinks}\n\n`;
      yield { type: 'content_chunk', content: referencedTablesMarkdown };
    }
    
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
      dbSpecificRules = '6. You MUST wrap ALL table and column names in DOUBLE QUOTES (e.g. "TableName", "rowCount", "userId"). PostgreSQL is case-sensitive for mixed-case identifiers. Do NOT use unquoted camelCase.\n7. Do NOT use Oracle functions like SYSDATE, NVL. Use NOW(), COALESCE.';
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

    // Fetch user's custom instructions
    const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const customInstructions = (currentUser?.preferences as any)?.customInstructions || '';

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
${customInstructions ? `\nUser Custom Instructions:\n${customInstructions}` : ''}

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

      // Debug: Log raw LLM output
      this.logger.debug(`[NL2SQL] Raw LLM output (first 500 chars): ${generatedSql.substring(0, 500)}`);

      // Remove reasoning/think tags from reasoning models (e.g., qwen3, deepseek-r1)
      // Pattern 1: <think>...</think> tags
      generatedSql = generatedSql.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      // Pattern 2: <reasoning>...</reasoning> tags  
      generatedSql = generatedSql.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim();
      // Pattern 3: Text before SQL keywords (remove everything before SELECT/WITH/CREATE/INSERT/UPDATE/DELETE)
      const sqlKeywordMatch = generatedSql.match(/(SELECT|WITH|CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\s/i);
      if (sqlKeywordMatch && sqlKeywordMatch.index && sqlKeywordMatch.index > 0) {
        generatedSql = generatedSql.substring(sqlKeywordMatch.index).trim();
        this.logger.log(`[NL2SQL] Trimmed preamble text, SQL starts with: ${generatedSql.substring(0, 50)}...`);
      }
      
      // Remove markdown code block formatting
      generatedSql = generatedSql.replace(/```sql\n?([\s\S]*?)\n?```/i, '$1').replace(/```\n?([\s\S]*?)\n?```/, '$1').trim();

      this.logger.log(`[NL2SQL] Cleaned SQL (first 200 chars): ${generatedSql.substring(0, 200)}`);
      
      // Check if this is a DDL statement
      const upperSqlCheck = generatedSql.toUpperCase().trim();
      const isDDLStatement = upperSqlCheck.startsWith('CREATE') || 
                             upperSqlCheck.startsWith('ALTER') || 
                             upperSqlCheck.startsWith('DROP');
      
      if (isDDLStatement && allowDDL) {
        // Preserve DDL statements as-is when DDL is allowed
        this.logger.log(`[DDL] Preserving DDL statement: ${generatedSql.substring(0, 100)}...`);
        // Extract only the first DDL statement (until semicolon)
        const ddlMatch = generatedSql.match(/^(CREATE|ALTER|DROP)[^;]+/i);
        if (ddlMatch) generatedSql = ddlMatch[0].trim();
      } else if (!isDDLStatement) {
        // Extract ONLY the first SELECT/WITH statement (stop at first semicolon or newline after statement)
        // More restrictive: capture from SELECT/WITH until semicolon, then stop
        const selectMatch = generatedSql.match(/(SELECT|WITH)\s+[\s\S]*?;/i);
        if (selectMatch) {
          generatedSql = selectMatch[0].replace(/;$/, '').trim();
        } else {
          // No semicolon found - try to extract until end of SQL-like content
          const noSemiMatch = generatedSql.match(/(SELECT|WITH)\s+[^\n]+/i);
          if (noSemiMatch) generatedSql = noSemiMatch[0].trim();
        }
      } else {
        // DDL attempted but not allowed - will be caught by validation
        this.logger.warn(`[DDL] DDL statement generated but DDL is not allowed`);
      }
      
      this.logger.log(`[NL2SQL] Final extracted SQL: ${generatedSql.substring(0, 150)}`);

      // PostgreSQL: Auto-wrap identifiers with double quotes if not already quoted
      if (dbType.toLowerCase().includes('postgres')) {
        generatedSql = this.wrapPostgresIdentifiers(generatedSql, schemaContext);
        this.logger.log(`[PostgreSQL] Applied identifier quoting: ${generatedSql.substring(0, 100)}...`);
      }

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
                   content: `${referencedTablesMarkdown}### SQL Generated\n\`\`\`sql\n${generatedSql}\n\`\`\`\n\n### Explanation\n${explanation}`,
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

          // DDL 실행 후 메타데이터 자동 동기화
          const executedSqlUpper = (validation.sanitizedSql || generatedSql).toUpperCase();
          const isDDL = executedSqlUpper.startsWith('CREATE') || executedSqlUpper.startsWith('ALTER') || executedSqlUpper.startsWith('DROP');
          if (isDDL) {
            this.logger.log(`[DDL] DDL 실행 성공, 메타데이터 자동 동기화 트리거`);
            yield { type: 'step_start', step: 'metadata_sync', message: '스키마 변경 감지, 메타데이터 동기화 중...' };
            try {
              await this.metadataService.syncMetadata(dataSourceId);
              this.logger.log(`[DDL] 메타데이터 동기화 완료`);
              yield { type: 'metadata_synced', message: '메타데이터가 자동으로 동기화되었습니다.' };
            } catch (syncError) {
              this.logger.warn(`[DDL] 메타데이터 동기화 실패: ${syncError.message}`);
            }
          }

          yield { type: 'execution_result', result };
        } catch (error) {
          // Auto-correction attempt
          this.logger.warn(`Execution failed, attempting auto-fix. Error: ${error.message}`);
          yield { type: 'step_start', step: 'auto_fix', message: 'SQL 실행 오류 발생, 자동 수정 시도 중...' };
          
          try {
              const fixedSql = await this.llmService.fixSQL(validation.sanitizedSql || generatedSql, error.message, schemaContext, dbType);
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

    // 1. 스키마 컨텍스트 조회 (Vector Search for Scalability)
    // Fetch DataSource to determine type first (needed for some logic, but searchSchemaContext handles context)
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
    });
    const dbType = dataSource?.type || 'postgresql';

    // Determine Top K
    let topK = 20;
    try {
      const activeConfig = await this.prisma.embeddingConfig.findFirst({
        where: { dataSourceId, isActive: true },
      }) || await this.prisma.embeddingConfig.findFirst({
        where: { dataSourceId: null, isActive: true },
      });
      if (activeConfig?.topK) topK = activeConfig.topK;
    } catch (e) { this.logger.warn(`Failed to fetch config: ${e.message}`); }

    const schemaSearch = await this.metadataService.searchSchemaContext(dataSourceId, question, topK);
    let schemaContext = schemaSearch.context;

    if (!schemaContext || schemaContext.trim() === '') {
      // Fallback for DDL
      const sqlSettings = await this.prisma.systemSettings.findMany({
          where: { key: { in: ['sql_allow_ddl'] } }
      });
      const allowDDL = sqlSettings.find(s => s.key === 'sql_allow_ddl')?.value === true;

      if (allowDDL) {
         schemaContext = `Database: ${dataSource?.database || 'unknown'}\nNote: Empty database.`;
      } else {
         throw new BadRequestException('데이터소스의 메타데이터를 먼저 동기화해주세요.');
      }
    }

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
           const fixedSql = await this.llmService.fixSQL(validation.sanitizedSql || finalSql, error.message, schemaContext, query.dataSource.type);
           
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

  async getRecommendedQuestions(
    dataSourceId: string,
    userId?: string,
    userName?: string,
    forceRegenerate?: boolean
  ): Promise<string[]> {
    // 1. 먼저 저장된 활성 질문이 있는지 확인
    const savedQuestions = await this.prisma.recommendedQuestion.findMany({
      where: { 
        dataSourceId, 
        isActive: true 
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      take: 8,
    });

    // 강제 생성이 아니고 저장된 질문이 4개 이상이면 그것을 반환
    if (!forceRegenerate && savedQuestions.length >= 4) {
      return savedQuestions.slice(0, 4).map(q => q.question);
    }

    // 2. AI로 새로 생성 (forceRegenerate인 경우 항상, 아니면 질문이 부족할 때)
    const context = await this.metadataService.getReviewableSchemaContext(dataSourceId);
    if (!context) return savedQuestions.map(q => q.question);
    
    this.logger.log(`Generating AI recommended questions (force: ${forceRegenerate})`);
    const generatedQuestions = await this.llmService.generateRecommendedQuestions(context, 4);

    // 3. 생성된 질문을 DB에 저장 (중복 제외)
    const existingQuestions = savedQuestions.map(q => q.question.toLowerCase());
    
    for (const question of generatedQuestions) {
      // 중복 체크
      if (existingQuestions.includes(question.toLowerCase())) {
        continue;
      }
      
      try {
        await this.prisma.recommendedQuestion.create({
          data: {
            dataSourceId,
            question,
            isAIGenerated: true,
            isActive: true,
            source: 'QUERY_PAGE',
            createdById: userId || null,
            createdByName: userName || null,
          },
        });
        this.logger.log(`Saved AI-generated question: ${question.substring(0, 50)}...`);
      } catch (e) {
        this.logger.warn(`Failed to save recommended question: ${e.message}`);
      }
    }

    // 4. 강제 생성이면 새 질문만, 아니면 기존+새 질문을 합쳐서 반환
    if (forceRegenerate) {
      return generatedQuestions.slice(0, 4);
    }

    const allQuestions = [
      ...savedQuestions.map(q => q.question),
      ...generatedQuestions.filter(q => !existingQuestions.includes(q.toLowerCase()))
    ];

    return allQuestions.slice(0, 4);
  }

  // ===========================================
  // Simulation (for admin verification)
  // ===========================================
  async simulateQuery(dataSourceId: string, question: string) {
    const steps: any[] = [];
    const startTime = Date.now();

    // Fetch DataSource
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
    });
    const dbType = dataSource?.type || 'postgresql';

    // Step 1: Embedding & Vector Search
    steps.push({ step: 1, name: 'embedding', status: 'running', startTime: Date.now() });
    const schemaResult = await this.metadataService.searchSchemaContextWithDetails(dataSourceId, question);
    steps[0].status = 'done';
    steps[0].endTime = Date.now();
    steps[0].timeMs = steps[0].endTime - steps[0].startTime;
    steps[0].data = {
      embedding: schemaResult.embedding,
      search: schemaResult.search
    };

    const schemaContext = schemaResult.context;

    // Step 2: Build Prompt
    steps.push({ step: 2, name: 'prompt', status: 'running', startTime: Date.now() });
    
    let dbSpecificRules = '';
    if (dbType.toLowerCase().includes('postgres')) {
      dbSpecificRules = '6. Wrap ALL table and column names in DOUBLE QUOTES for PostgreSQL.';
    } else if (dbType.toLowerCase().includes('oracle')) {
      dbSpecificRules = '6. For Oracle: Use VARCHAR2, NUMBER, CLOB, SYSDATE. No LIMIT clause - use FETCH FIRST N ROWS ONLY.';
    } else if (dbType.toLowerCase().includes('mysql')) {
      dbSpecificRules = '6. Wrap all identifiers in BACKTICKS for MySQL.';
    }

    const systemPrompt = `You are an expert SQL query generator.
Rules:
1. Only generate SELECT queries
2. Always include LIMIT clause (max 1000)
3. Return ONLY the SQL query
${dbSpecificRules}

Database Schema:
${schemaContext}`;

    const userPrompt = question;

    steps[1].status = 'done';
    steps[1].endTime = Date.now();
    steps[1].timeMs = steps[1].endTime - steps[1].startTime;
    steps[1].data = {
      systemPrompt: systemPrompt.substring(0, 1000) + (systemPrompt.length > 1000 ? '...' : ''),
      userPrompt,
      fullPromptLength: systemPrompt.length + userPrompt.length
    };

    // Step 3: AI Generation
    steps.push({ step: 3, name: 'generation', status: 'running', startTime: Date.now() });
    
    let rawResponse = '';
    let reasoning = '';
    
    try {
      const stream = this.llmService.generateStream({
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        temperature: 0.1,
        maxTokens: 2048,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content') {
          rawResponse += chunk.content;
        }
      }

      // Extract reasoning from thinking models
      const thinkMatch = rawResponse.match(/<think>([\s\S]*?)<\/think>/i);
      const reasoningMatch = rawResponse.match(/<reasoning>([\s\S]*?)<\/reasoning>/i);
      reasoning = thinkMatch?.[1] || reasoningMatch?.[1] || '';

      steps[2].status = 'done';
      steps[2].endTime = Date.now();
      steps[2].timeMs = steps[2].endTime - steps[2].startTime;
      steps[2].data = {
        rawResponseLength: rawResponse.length,
        hasReasoning: !!reasoning,
        reasoning: reasoning.substring(0, 500) + (reasoning.length > 500 ? '...' : '')
      };
    } catch (error) {
      steps[2].status = 'error';
      steps[2].error = error.message;
      steps[2].endTime = Date.now();
      steps[2].timeMs = steps[2].endTime - steps[2].startTime;
      
      return {
        success: false,
        steps,
        totalTimeMs: Date.now() - startTime,
        error: error.message
      };
    }

    // Step 4: SQL Extraction & Cleanup
    steps.push({ step: 4, name: 'extraction', status: 'running', startTime: Date.now() });
    
    let generatedSql = rawResponse;
    // Remove thinking tags
    generatedSql = generatedSql.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    generatedSql = generatedSql.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim();
    // Remove markdown
    generatedSql = generatedSql.replace(/```sql\n?([\s\S]*?)\n?```/i, '$1').replace(/```\n?([\s\S]*?)\n?```/, '$1').trim();
    // Extract first SQL statement
    const sqlMatch = generatedSql.match(/(SELECT|WITH)\s+[\s\S]*?;/i);
    if (sqlMatch) {
      generatedSql = sqlMatch[0].replace(/;$/, '').trim();
    }

    steps[3].status = 'done';
    steps[3].endTime = Date.now();
    steps[3].timeMs = steps[3].endTime - steps[3].startTime;
    steps[3].data = {
      extractedSql: generatedSql
    };

    // Step 5: Validation
    steps.push({ step: 5, name: 'validation', status: 'running', startTime: Date.now() });
    
    const validation = this.validationService.validate(generatedSql);
    const risk = this.analyzeRisk(generatedSql);
    const trustScore = this.calculateTrustScore(generatedSql);

    steps[4].status = 'done';
    steps[4].endTime = Date.now();
    steps[4].timeMs = steps[4].endTime - steps[4].startTime;
    steps[4].data = {
      isValid: validation.isValid,
      errors: validation.errors,
      riskLevel: risk.level,
      riskReasons: risk.reasons,
      trustScore: Math.round(trustScore * 100)
    };

    const totalTimeMs = Date.now() - startTime;

    return {
      success: true,
      steps,
      totalTimeMs,
      result: {
        sql: generatedSql,
        validation: validation.isValid,
        riskLevel: risk.level,
        trustScore: Math.round(trustScore * 100)
      }
    };
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

  /**
   * PostgreSQL용 식별자 래핑 - 테이블/컬럼 이름에 자동으로 따옴표 추가
   */
  private wrapPostgresIdentifiers(sql: string, schemaContext: string): string {
    // 스키마에서 테이블 이름 추출
    const tableMatches = schemaContext.match(/Table:\s*(\w+)/gi) || [];
    const tables = tableMatches.map(m => m.replace(/Table:\s*/i, '').trim());
    
    // 스키마에서 컬럼 이름 추출 (- columnName: type 형식)
    const columnMatches = schemaContext.match(/- (\w+):/g) || [];
    const columns = columnMatches.map(m => m.replace(/- /, '').replace(/:/, '').trim());
    
    // 모든 식별자 수집 (중복 제거)
    const identifiers = [...new Set([...tables, ...columns])];
    
    if (identifiers.length === 0) {
      return sql;
    }
    
    let wrappedSql = sql;
    
    // 각 식별자를 따옴표로 래핑 (이미 따옴표로 감싸진 경우 제외)
    for (const identifier of identifiers) {
      if (!identifier || identifier.length < 2) continue;
      
      // 이미 따옴표로 감싸져 있지 않은 식별자만 래핑
      // 패턴: 따옴표 없이 나타나는 식별자 (단어 경계 사용)
      const regex = new RegExp(
        `(?<!")\\b${identifier}\\b(?!")`,
        'g'
      );
      
      wrappedSql = wrappedSql.replace(regex, `"${identifier}"`);
    }
    
    return wrappedSql;
  }
}
