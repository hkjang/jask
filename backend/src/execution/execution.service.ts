import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSourcesService } from '../datasources/datasources.service';
import { ValidationService } from '../validation/validation.service';
import { Client as PgClient } from 'pg';
import * as mysql from 'mysql2/promise';

export interface ExecutionResult {
  rows: any[];
  rowCount: number;
  fields: { name: string; type: string }[];
  executionTime: number;
  truncated: boolean;
}

export interface ExecutionOptions {
  mode: 'preview' | 'execute';
  maxRows?: number;
  timeout?: number;
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

    const sanitizedSql = validation.sanitizedSql || sql;

    const { client, type } = await this.dataSourcesService.getConnection(dataSourceId);
    const dataSource = await this.dataSourcesService.findOne(dataSourceId);
    const maxRows = options.maxRows || this.defaultMaxRows;
    const timeout = options.timeout || this.defaultTimeout;

    try {
      if (dataSource.type === 'postgresql') {
        return await this.executePostgreSQL(
          client as PgClient,
          sanitizedSql,
          maxRows,
          timeout,
          startTime,
        );
      } else if (dataSource.type === 'mysql') {
        return await this.executeMySQL(
          client as mysql.Connection,
          sanitizedSql,
          maxRows,
          timeout,
          startTime,
        );
      }

      throw new BadRequestException(`지원하지 않는 데이터베이스 타입: ${dataSource.type}`);
    } catch (error) {
      this.logger.error(`SQL 실행 실패: ${error.message}`);
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

  private formatError(error: any): string {
    const message = error.message || '알 수 없는 오류가 발생했습니다.';

    // 사용자 친화적 에러 메시지로 변환
    if (message.includes('relation') && message.includes('does not exist')) {
      const tableMatch = message.match(/relation "([^"]+)"/);
      return `테이블을 찾을 수 없습니다${tableMatch ? `: ${tableMatch[1]}` : ''}`;
    }

    if (message.includes('column') && message.includes('does not exist')) {
      const colMatch = message.match(/column "([^"]+)"/);
      return `컬럼을 찾을 수 없습니다${colMatch ? `: ${colMatch[1]}` : ''}`;
    }

    if (message.includes('syntax error')) {
      return `SQL 문법 오류: ${message}`;
    }

    if (message.includes('permission denied')) {
      return '해당 테이블에 대한 접근 권한이 없습니다.';
    }

    if (message.includes('timeout') || message.includes('canceling statement')) {
      return '쿼리 실행 시간이 초과되었습니다. 쿼리를 최적화해주세요.';
    }

    return message;
  }
}
