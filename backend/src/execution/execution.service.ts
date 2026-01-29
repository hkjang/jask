import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSourcesService } from '../datasources/datasources.service';
import { ValidationService } from '../validation/validation.service';
import { AuditService } from '../audit/audit.service';
import { Client as PgClient } from 'pg';
import * as mysql from 'mysql2/promise';
import oracledb from 'oracledb';

export interface ExecutionResult {
  rows: any[];
  rowCount: number;
  fields: { name: string; type: string }[];
  executionTime: number;
  truncated: boolean;
  // Batch execution results (for multi-statement DML)
  batchResults?: BatchStatementResult[];
  hasPartialFailure?: boolean;
}

export interface BatchStatementResult {
  index: number;
  sql: string;
  success: boolean;
  rowsAffected?: number;
  error?: string;
}

export interface ExecutionOptions {
  mode: 'preview' | 'execute';
  maxRows?: number;
  timeout?: number;
  skipOnError?: boolean; // Continue executing remaining statements if one fails
  userId?: string;
  userEmail?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private readonly defaultMaxRows: number;
  private readonly defaultTimeout: number;

  constructor(
    private configService: ConfigService,
    private dataSourcesService: DataSourcesService,
    private validationService: ValidationService,
    private auditService: AuditService,
  ) {
    this.defaultMaxRows = this.configService.get<number>('SQL_MAX_ROWS', 1000);
    this.defaultTimeout = this.configService.get<number>('SQL_TIMEOUT_MS', 30000);
  }

  async execute(
    dataSourceId: string,
    sql: string,
    options: ExecutionOptions = { mode: 'execute' },
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // SQL 검증
    const validation = this.validationService.validate(sql);
    if (!validation.isValid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // DDL/DML/SELECT 타입 판별
    const upperSql = validation.sanitizedSql?.toUpperCase() || sql.toUpperCase();
    const isDDL = upperSql.startsWith('CREATE') || upperSql.startsWith('ALTER') || upperSql.startsWith('DROP') || upperSql.startsWith('TRUNCATE');
    const isDML = upperSql.startsWith('INSERT') || upperSql.startsWith('UPDATE') || upperSql.startsWith('DELETE');
    const isSelect = upperSql.startsWith('SELECT') || upperSql.startsWith('WITH');
    const operation = upperSql.split(/\s+/)[0];
    
    // 테이블명 추출 시도
    let tableName: string | undefined;
    const fromMatch = sql.match(/(?:FROM|INTO|UPDATE|TABLE)\s+["']?(\w+)["']?/i);
    if (fromMatch) tableName = fromMatch[1];

    const sanitizedSql = validation.sanitizedSql || sql;
    const { client, type } = await this.dataSourcesService.getConnection(dataSourceId);
    const dataSource = await this.dataSourcesService.findOne(dataSourceId);
    const maxRows = options.maxRows || this.defaultMaxRows;
    const timeout = options.timeout || this.defaultTimeout;

    try {
      let result: ExecutionResult;

      if (dataSource.type === 'postgresql') {
        const finalSql = this.addPgLimit(sanitizedSql, maxRows);
        result = await this.executePostgreSQL(
          client as PgClient,
          finalSql,
          maxRows,
          timeout,
          startTime,
        );
      } else if (dataSource.type === 'mysql') {
        const finalSql = this.addMySqlLimit(sanitizedSql, maxRows);
        result = await this.executeMySQL(
          client as mysql.Connection,
          finalSql,
          maxRows,
          timeout,
          startTime,
        );
      } else if (dataSource.type === 'oracle') {
        // Oracle: Semicolon removal for SELECTs + ROWNUM limit
        let finalSql = sanitizedSql;
        
        // Remove trailing semicolon
        finalSql = finalSql.replace(/;+$/, '').trim();

        // Add limit
        finalSql = this.addOracleLimit(finalSql, maxRows);

        result = await this.executeOracle(
          client as oracledb.Connection,
          finalSql,
          maxRows,
          timeout,
          startTime,
          options,
        );
      } else {
        throw new BadRequestException(`지원하지 않는 데이터베이스 타입: ${dataSource.type}`);
      }

      // 성공 감사 로그
      if (isDDL) {
        await this.auditService.logDDL(operation as any, `DDL 실행: ${operation} ${tableName || ''}`, {
          userId: options.userId,
          userEmail: options.userEmail,
          userName: options.userName,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          dataSourceId,
          dataSourceName: dataSource.name,
          sqlQuery: sql,
          tableName,
          executionTime: result.executionTime,
          success: true,
          metadata: { destructiveOperations: validation.destructiveOperations },
        });
      } else if (isDML) {
        await this.auditService.logDML(operation as any, `DML 실행: ${operation} ${tableName || ''}`, {
          userId: options.userId,
          userEmail: options.userEmail,
          userName: options.userName,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          dataSourceId,
          dataSourceName: dataSource.name,
          sqlQuery: sql,
          tableName,
          affectedRows: result.rowCount,
          executionTime: result.executionTime,
          success: true,
        });
      } else if (isSelect) {
        // SELECT 쿼리는 대량 데이터 접근만 로깅
        if (result.rowCount >= 1000) {
          await this.auditService.logDataAccess('BULK_ACCESS', `대량 데이터 조회: ${result.rowCount}건`, {
            userId: options.userId,
            userEmail: options.userEmail,
            userName: options.userName,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
            dataSourceId,
            dataSourceName: dataSource.name,
            sqlQuery: sql,
            tableName,
            affectedRows: result.rowCount,
            executionTime: result.executionTime,
            success: true,
          });
        }
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`SQL 실행 실패: ${error.message}`);

      // 실패 감사 로그
      if (isDDL) {
        await this.auditService.logDDL(operation as any, `DDL 실행 실패: ${operation}`, {
          userId: options.userId,
          userEmail: options.userEmail,
          userName: options.userName,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          dataSourceId,
          dataSourceName: dataSource.name,
          sqlQuery: sql,
          tableName,
          executionTime,
          success: false,
          errorMessage: this.formatError(error),
        });
      } else if (isDML) {
        await this.auditService.logDML(operation as any, `DML 실행 실패: ${operation}`, {
          userId: options.userId,
          userEmail: options.userEmail,
          userName: options.userName,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          dataSourceId,
          dataSourceName: dataSource.name,
          sqlQuery: sql,
          tableName,
          executionTime,
          success: false,
          errorMessage: this.formatError(error),
        });
      }

      throw new BadRequestException(this.formatError(error));
    }
  }

  async preview(dataSourceId: string, sql: string): Promise<ExecutionResult> {
    // Preview 모드: 제한된 결과만 반환
    return this.execute(dataSourceId, sql, {
      mode: 'preview',
      maxRows: 10,
      timeout: 5000,
    });
  }

  async explain(dataSourceId: string, sql: string): Promise<any> {
    const { client, type } = await this.dataSourcesService.getConnection(dataSourceId);
    const dataSource = await this.dataSourcesService.findOne(dataSourceId);

    try {
      if (dataSource.type === 'postgresql') {
        const result = await (client as PgClient).query(`EXPLAIN (FORMAT JSON) ${sql}`);
        return result.rows;
      } else if (dataSource.type === 'mysql') {
        const [rows] = await (client as mysql.Connection).query(`EXPLAIN ${sql}`) as any;
        return rows;
      } else if (dataSource.type === 'oracle') {
        // Oracle EXPLAIN PLAN
        await (client as oracledb.Connection).execute(`EXPLAIN PLAN FOR ${sql}`);
        const result = await (client as oracledb.Connection).execute(
          `SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY)`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return result.rows;
      }
    } catch (error) {
      this.logger.error(`EXPLAIN 실패: ${error.message}`);
      throw new BadRequestException(this.formatError(error));
    }
  }

  private async executePostgreSQL(
    client: PgClient,
    sql: string,
    maxRows: number,
    timeout: number,
    startTime: number,
  ): Promise<ExecutionResult> {
    // 타임아웃 설정
    await client.query(`SET statement_timeout = ${timeout}`);

    const result = await client.query(sql);

    const executionTime = Date.now() - startTime;
    const truncated = result.rows.length >= maxRows;

    return {
      rows: result.rows.slice(0, maxRows),
      rowCount: result.rowCount || result.rows.length,
      fields: result.fields?.map((f: { name: string; dataTypeID: number }) => ({
        name: f.name,
        type: this.mapPgType(f.dataTypeID),
      })) || [],
      executionTime,
      truncated,
    };
  }

  private async executeMySQL(
    client: mysql.Connection,
    sql: string,
    maxRows: number,
    timeout: number,
    startTime: number,
  ): Promise<ExecutionResult> {
    // MySQL 타임아웃 설정
    await client.query(`SET SESSION MAX_EXECUTION_TIME = ${timeout}`);

    const [rows, fields] = await client.query(sql) as any;

    const executionTime = Date.now() - startTime;
    const rowsArray = Array.isArray(rows) ? rows : [rows];
    const truncated = rowsArray.length >= maxRows;

    return {
      rows: rowsArray.slice(0, maxRows),
      rowCount: rowsArray.length,
      fields: fields?.map((f: any) => ({
        name: f.name,
        type: f.type?.toString() || 'unknown',
      })) || [],
      executionTime,
      truncated,
    };
  }

  private async executeOracle(
    client: oracledb.Connection,
    sql: string,
    maxRows: number,
    timeout: number,
    startTime: number,
    options?: ExecutionOptions,
  ): Promise<ExecutionResult> {
    const upperSql = sql.trim().toUpperCase();
    const isSelect = upperSql.startsWith('SELECT') || upperSql.startsWith('WITH');
    const isDDL = upperSql.startsWith('CREATE') || upperSql.startsWith('ALTER') || upperSql.startsWith('DROP') || upperSql.startsWith('TRUNCATE');
    const isDML = upperSql.startsWith('INSERT') || upperSql.startsWith('UPDATE') || upperSql.startsWith('DELETE');

    this.logger.log(`Oracle Execute - SQL Type: isSelect=${isSelect}, isDDL=${isDDL}, isDML=${isDML}, First20Chars="${upperSql.substring(0, 20)}"`);

    let result: any;
    
    if (isSelect) {
      // SELECT queries - fetch all rows
      result = await client.execute(sql, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
    } else if (isDDL || isDML) {
      // DDL/DML - handle multiple statements separated by semicolons
      // Normalize line endings and split by semicolon
      const normalizedSql = sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const statements = normalizedSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      this.logger.log(`[Oracle DDL/DML] Parsed ${statements.length} statement(s) from SQL`);
      statements.forEach((stmt, idx) => {
        this.logger.debug(`[Oracle] Statement ${idx + 1}: ${stmt.substring(0, 80)}...`);
      });
      
      const batchResults: { index: number; sql: string; success: boolean; rowsAffected?: number; error?: string }[] = [];
      let totalRowsAffected = 0;
      let executedCount = 0;
      let failedCount = 0;
      
      // Check if we should skip errors and continue (for partial execution recovery)
      const skipOnError = options?.skipOnError ?? false;
      
      // Check if transaction mode is enabled (only for DML, not DDL, and not when skipping errors)
      // DDL auto-commits in Oracle, so transaction mode only applies to DML
      const useTransaction = isDML && statements.length > 1 && !skipOnError;
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          const stmtResult = await client.execute(stmt, [], {
            autoCommit: !useTransaction && !skipOnError, // Auto-commit each statement when skipping errors
          });
          const affected = stmtResult.rowsAffected || 0;
          totalRowsAffected += affected;
          executedCount++;
          batchResults.push({
            index: i,
            sql: stmt,
            success: true,
            rowsAffected: affected,
          });
        } catch (error: any) {
          failedCount++;
          const errorMsg = this.formatError(error);
          batchResults.push({
            index: i,
            sql: stmt,
            success: false,
            error: errorMsg,
          });
          
          if (skipOnError) {
            // Continue to next statement
            this.logger.warn(`[Oracle] Statement ${i + 1} failed: ${errorMsg}, continuing...`);
          } else {
            // Rollback and check if partial failure
            if (useTransaction && executedCount > 0) {
              await client.rollback();
              this.logger.warn(`Transaction rolled back: ${executedCount}/${statements.length} statements executed before failure`);
            }
            
            // For multi-statement batch, don't throw - return partial results for frontend handling
            const isMultiStatement = statements.length > 1;
            if (isMultiStatement) {
              // Mark remaining statements as not executed
              for (let j = i + 1; j < statements.length; j++) {
                batchResults.push({
                  index: j,
                  sql: statements[j],
                  success: false,
                  error: '이전 문장 실패로 실행되지 않음',
                });
              }
              
              // Return partial results so frontend can offer recovery
              result = {
                rowsAffected: totalRowsAffected,
                statementsExecuted: executedCount,
                batchResults,
                hasPartialFailure: true,
                failedAt: i,
                firstError: errorMsg,
                successCount: executedCount,
                failedCount: statements.length - executedCount,
              };
              // Don't throw - let the result flow through to frontend
              break;
            }
            throw error;
          }
        }
      }
      
      // Commit transaction if all statements succeeded
      if (useTransaction && failedCount === 0) {
        await client.commit();
        this.logger.log(`Transaction committed: ${executedCount} statements`);
      }
      
      const hasPartialFailure = failedCount > 0 && executedCount > 0;
      
      result = { 
        rowsAffected: totalRowsAffected,
        statementsExecuted: statements.length,
        transactionUsed: useTransaction,
        batchResults,
        hasPartialFailure,
        successCount: executedCount,
        failedCount,
      };
    } else {
      // Other statements
      result = await client.execute(sql, [], {
        autoCommit: true,
      });
    }

    const executionTime = Date.now() - startTime;
    
    if (isSelect) {
      const rawRows = result.rows || [];
      const truncated = rawRows.length > maxRows;
      
      // Deep clone to plain objects to avoid circular reference issues (NVPair)
      // Handle CLOB/LOB objects specially
      const rows = await Promise.all(rawRows.slice(0, maxRows).map(async (row: any) => {
        const plainRow: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          const val = row[key];
          if (val === null || val === undefined) {
            plainRow[key] = val;
          } else if (typeof val === 'object' && val.getData) {
            // Oracle LOB object - read the data
            try {
              plainRow[key] = await val.getData();
            } catch {
              plainRow[key] = '[LOB data]';
            }
          } else if (typeof val === 'object' && val instanceof Date) {
            plainRow[key] = val.toISOString();
          } else if (typeof val !== 'object') {
            plainRow[key] = val;
          } else if (Buffer.isBuffer(val)) {
            plainRow[key] = val.toString('base64');
          } else {
            // Try to get a string representation
            try {
              plainRow[key] = JSON.stringify(val);
            } catch {
              plainRow[key] = String(val);
            }
          }
        }
        return plainRow;
      }));
      
      return {
        rows,
        rowCount: rawRows.length,
        fields: result.metaData?.map((m: any) => ({
          name: m.name,
          type: this.mapOracleType(m.dbType),
        })) || [],
        executionTime,
        truncated,
      };
    } else {
      // DDL/DML result
      const stmtCount = result.statementsExecuted || 1;
      const rowsAffected = result.rowsAffected || 0;
      const hasPartialFailure = result.hasPartialFailure || false;
      const batchResults = result.batchResults;
      
      let message = '';
      if (hasPartialFailure) {
        const successCount = result.successCount || 0;
        const failedCount = result.failedCount || 0;
        message = `${successCount}개 성공, ${failedCount}개 실패 (총 ${stmtCount}개 문장)`;
      } else if (isDDL) {
        message = `DDL 명령이 성공적으로 실행되었습니다. (${stmtCount}개 문장)`;
      } else {
        message = `${rowsAffected}개의 행이 영향받았습니다. (${stmtCount}개 문장 실행)`;
      }
      
      return {
        rows: [{ message }],
        rowCount: rowsAffected || (isDDL ? stmtCount : 0),
        fields: [{ name: 'message', type: 'varchar2' }],
        executionTime,
        truncated: false,
        batchResults,
        hasPartialFailure,
      };
    }
  }

  private mapPgType(typeId: number): string {
    // PostgreSQL 타입 ID 매핑
    const typeMap: Record<number, string> = {
      16: 'boolean',
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      700: 'real',
      701: 'double',
      1043: 'varchar',
      1082: 'date',
      1114: 'timestamp',
      1184: 'timestamptz',
      2950: 'uuid',
      3802: 'jsonb',
    };
    return typeMap[typeId] || 'unknown';
  }

  private mapOracleType(dbType: number): string {
    // Oracle DB Type mapping - comprehensive list
    const typeMap: Record<number, string> = {
      // String Types
      1: 'varchar2',
      96: 'char',
      8: 'long',
      1001: 'nvarchar2',
      1096: 'nchar',
      
      // Numeric Types
      2: 'number',
      3: 'binary_integer',
      100: 'binary_float',
      101: 'binary_double',
      
      // Date/Time Types
      12: 'date',
      180: 'timestamp',
      181: 'timestamp with time zone',
      231: 'timestamp with local time zone',
      182: 'interval year to month',
      183: 'interval day to second',
      
      // LOB Types
      112: 'clob',
      1112: 'nclob',
      113: 'blob',
      114: 'bfile',
      24: 'long raw',
      
      // Binary Types
      23: 'raw',
      104: 'rowid',
      208: 'urowid',
      
      // Other Types
      102: 'ref cursor',
      252: 'boolean',
      108: 'object',
      119: 'json',
      109: 'xmltype',
    };
    return typeMap[dbType] || 'unknown';
  }

  private formatError(error: any): string {
    const message = error.message || '알 수 없는 오류가 발생했습니다.';
    const errorNum = error.errorNum; // Oracle ORA-XXXXX

    // Oracle 특화 에러 메시지 (ORA-XXXXX)
    if (errorNum) {
      const oracleErrors: Record<number, string> = {
        942: '테이블 또는 뷰가 존재하지 않습니다.',
        904: '컬럼명이 잘못되었습니다.',
        900: 'SQL 문법 오류입니다.',
        1017: '사용자명/비밀번호가 잘못되었습니다.',
        12154: 'TNS:서비스 이름을 확인할 수 없습니다.',
        12541: 'TNS:리스너가 없습니다. 연결을 확인하세요.',
        12514: 'TNS:리스너가 서비스를 알지 못합니다.',
        12505: 'TNS:리스너가 SID를 알지 못합니다.',
        1013: '요청이 취소되었습니다.',
        1033: 'Oracle이 초기화/종료 중입니다.',
        1034: 'Oracle을 사용할 수 없습니다.',
        1403: '데이터가 없습니다.',
        1722: '숫자가 잘못되었습니다.',
        1843: '날짜 형식이 잘못되었습니다.',
        1861: '리터럴이 형식 문자열과 일치하지 않습니다.',
        936: '표현식이 없습니다.',
        923: 'FROM 키워드가 필요합니다.',
        907: '오른쪽 괄호가 누락되었습니다.',
        906: '왼쪽 괄호가 누락되었습니다.',
        1: '고유 제약 조건 위반입니다.',
        1400: 'NULL을 삽입할 수 없습니다.',
        2291: '외래 키 제약 조건 위반 - 부모 키가 없습니다.',
        2292: '외래 키 제약 조건 위반 - 자식 레코드가 존재합니다.',
        // Extended error codes
        28: '세션이 종료되었습니다. 다시 연결하세요.',
        54: '리소스가 사용 중입니다. 잠시 후 다시 시도하세요.',
        60: '교착 상태 감지됨. 트랜잭션이 롤백되었습니다.',
        1410: '잘못된 ROWID입니다.',
        1438: '숫자의 자릿수가 허용 범위를 초과합니다.',
        1427: '단일 행 하위 쿼리가 여러 행을 반환했습니다.',
        1476: '0으로 나눌 수 없습니다.',
        1652: '임시 세그먼트를 확장할 수 없습니다.',
        1654: '인덱스를 확장할 수 없습니다.',
        1688: '테이블을 파티션 확장할 수 없습니다.',
        4031: '공유 메모리가 부족합니다.',
        4068: '패키지 상태가 삭제되었습니다. 다시 실행하세요.',
        12170: 'TNS 연결 시간이 초과되었습니다.',
        12537: '연결이 끊어졌습니다.',
        12560: 'TNS 프로토콜 어댑터 오류입니다.',
        12899: '값이 너무 큽니다. 컬럼 크기를 확인하세요.',
        22992: '드라이버가 CLOB을 여는 데 실패했습니다.',
      };
      
      if (oracleErrors[errorNum]) {
        return `ORA-${errorNum}: ${oracleErrors[errorNum]} (ORA-${('00000' + errorNum).slice(-5)}: ${error.message})`;
      }
      return `ORA-${errorNum}: ${message} (ORA-${('00000' + errorNum).slice(-5)})`;
    }

    // PostgreSQL/MySQL 에러 메시지
    if (message.includes('relation') && message.includes('does not exist')) {
      const tableMatch = message.match(/relation "([^"]+)"/);
      return `테이블을 찾을 수 없습니다${tableMatch ? `: ${tableMatch[1]}` : ''} (${message})`;
    }

    if (message.includes('column') && message.includes('does not exist')) {
      const colMatch = message.match(/column "([^"]+)"/);
      return `컬럼을 찾을 수 없습니다${colMatch ? `: ${colMatch[1]}` : ''} (${message})`;
    }

    if (message.includes('syntax error')) {
      return `SQL 문법 오류: ${message}`;
    }

    return message;
  }

  // --- Helper Methods for Limit ---

  private addPgLimit(sql: string, limit: number): string {
    const upperSql = sql.toUpperCase();
    if (upperSql.includes('LIMIT') || !upperSql.startsWith('SELECT')) return sql;
    return `${sql} LIMIT ${limit}`;
  }

  private addMySqlLimit(sql: string, limit: number): string {
    const upperSql = sql.toUpperCase();
    if (upperSql.includes('LIMIT') || !upperSql.startsWith('SELECT')) return sql;
    return `${sql} LIMIT ${limit}`;
  }

  private addOracleLimit(sql: string, limit: number): string {
    const upperSql = sql.toUpperCase().trim();
    if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) return sql;

    // Check existing limits
    if (upperSql.includes('ROWNUM') || upperSql.includes('FETCH FIRST')) return sql;
    
    // If simple query (no ORDER BY), safe to append WHERE ROWNUM <= N
    // But wrapping is safer for preserving logic (though performance might vary)
    // Using wrapping for correctness with ORDER BY and complex structures
    return `SELECT * FROM (${sql}) WHERE ROWNUM <= ${limit}`;
  }
}
