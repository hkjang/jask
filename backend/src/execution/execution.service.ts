import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSourcesService } from '../datasources/datasources.service';
import { ValidationService } from '../validation/validation.service';
import { Client as PgClient } from 'pg';
import * as mysql from 'mysql2/promise';
import oracledb from 'oracledb';

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
      } else if (dataSource.type === 'oracle') {
        return await this.executeOracle(
          client as oracledb.Connection,
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
  ): Promise<ExecutionResult> {
    // Oracle doesn't have session-level timeout, we use fetchArraySize for row limit
    const result = await client.execute(sql, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      maxRows: maxRows + 1, // +1 to detect truncation
    });

    const executionTime = Date.now() - startTime;
    const rows = result.rows || [];
    const truncated = rows.length > maxRows;

    return {
      rows: rows.slice(0, maxRows),
      rowCount: rows.length,
      fields: result.metaData?.map((m: any) => ({
        name: m.name,
        type: this.mapOracleType(m.dbType),
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
      };
      
      if (oracleErrors[errorNum]) {
        return `ORA-${errorNum}: ${oracleErrors[errorNum]}`;
      }
      return `ORA-${errorNum}: ${message}`;
    }

    // PostgreSQL/MySQL 에러 메시지
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
