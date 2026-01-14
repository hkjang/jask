import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedSql?: string;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);
  private readonly maxRows: number;
  private readonly allowWrites: boolean;
  private readonly allowDDL: boolean;

  // 위험 키워드 목록
  private readonly dangerousKeywords = [
    'DELETE', 'DROP', 'TRUNCATE', 'UPDATE', 'INSERT', 'ALTER',
    'CREATE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'MERGE',
    'REPLACE', 'CALL', 'SET', 'DECLARE',
  ];

  // 위험한 함수 패턴
  private readonly dangerousPatterns = [
    /;\s*\w/i,                    // 다중 쿼리 (세미콜론 후 다른 키워드)
    /--.*$/gm,                    // SQL 주석
    /\/\*[\s\S]*?\*\//g,          // 블록 주석
    /INTO\s+OUTFILE/i,            // 파일 출력
    /INTO\s+DUMPFILE/i,           // 덤프 파일
    /LOAD_FILE\s*\(/i,            // 파일 로드
    /xp_cmdshell/i,               // SQL Server 명령 실행
    /BENCHMARK\s*\(/i,            // MySQL 벤치마크 (DoS)
    /SLEEP\s*\(/i,                // 지연 함수 (DoS)
    /WAITFOR\s+DELAY/i,           // SQL Server 지연
  ];

  constructor(private configService: ConfigService) {
    this.maxRows = this.configService.get<number>('SQL_MAX_ROWS', 1000);
    this.allowWrites = this.configService.get<boolean>('SQL_ALLOW_WRITES', false);
    this.allowDDL = this.configService.get<boolean>('SQL_ALLOW_DDL', false);
  }

  validate(sql: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 빈 쿼리 검증
    if (!sql || !sql.trim()) {
      return {
        isValid: false,
        errors: ['SQL 쿼리가 비어있습니다.'],
        warnings: [],
      };
    }

    const normalizedSql = sql.toUpperCase().trim();

    // SELECT 쿼리만 허용 (DDL/DML 허용 설정이 있으면 예외)
    const isSelectOrWith = normalizedSql.startsWith('SELECT') || normalizedSql.startsWith('WITH');
    const isDDL = normalizedSql.startsWith('CREATE') || normalizedSql.startsWith('ALTER') || normalizedSql.startsWith('DROP');
    const isDML = normalizedSql.startsWith('INSERT') || normalizedSql.startsWith('UPDATE') || normalizedSql.startsWith('DELETE');
    
    if (!isSelectOrWith) {
      if (isDDL && !this.allowDDL) {
        errors.push('DDL 명령(CREATE/ALTER/DROP)은 허용되지 않습니다. 설정에서 SQL_ALLOW_DDL을 활성화하세요.');
      } else if (isDML && !this.allowWrites) {
        errors.push('DML 명령(INSERT/UPDATE/DELETE)은 허용되지 않습니다. 설정에서 SQL_ALLOW_WRITES를 활성화하세요.');
      } else if (!isDDL && !isDML) {
        errors.push('SELECT 쿼리만 허용됩니다.');
      }
    }

    // 위험 키워드 검사
    for (const keyword of this.dangerousKeywords) {
      // 단어 경계를 확인하여 정확한 키워드 매칭
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(normalizedSql)) {
        // DDL 허용 설정 확인
        if (this.allowDDL && ['CREATE', 'ALTER', 'DROP'].includes(keyword)) {
          warnings.push(`${keyword} 명령이 포함되어 있습니다. DDL 작업에 주의하세요.`);
        } else if (this.allowWrites && ['INSERT', 'UPDATE', 'DELETE'].includes(keyword)) {
          warnings.push(`${keyword} 명령이 포함되어 있습니다. 주의하세요.`);
        } else if (!this.allowDDL && ['CREATE', 'ALTER', 'DROP'].includes(keyword)) {
          errors.push(`${keyword} 명령은 허용되지 않습니다. (SQL_ALLOW_DDL=true 필요)`);
        } else if (!this.allowWrites && ['INSERT', 'UPDATE', 'DELETE'].includes(keyword)) {
          errors.push(`${keyword} 명령은 허용되지 않습니다. (SQL_ALLOW_WRITES=true 필요)`);
        } else {
          errors.push(`${keyword} 명령은 허용되지 않습니다.`);
        }
      }
    }

    // 위험한 패턴 검사
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(sql)) {
        errors.push('잠재적으로 위험한 SQL 패턴이 감지되었습니다.');
        break;
      }
    }

    // LIMIT 검사
    if (!normalizedSql.includes('LIMIT') && !normalizedSql.includes('TOP') && 
        !normalizedSql.includes('FETCH FIRST') && !normalizedSql.includes('ROWNUM')) {
      warnings.push(`LIMIT 절이 없습니다. 최대 ${this.maxRows}개로 제한됩니다.`);
    }

    // SQL 정제
    let sanitizedSql = this.sanitize(sql);

    // LIMIT 강제 추가
    if (!normalizedSql.includes('LIMIT')) {
      sanitizedSql = this.addLimit(sanitizedSql, this.maxRows);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedSql,
    };
  }

  private sanitize(sql: string): string {
    // 주석 제거
    let sanitized = sql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    // 끝에 세미콜론 제거
    sanitized = sanitized.replace(/;+$/, '');

    // 다중 쿼리 방지 - 첫 번째 쿼리만 사용
    const firstQuery = sanitized.split(';')[0];

    return firstQuery.trim();
  }

  private addLimit(sql: string, limit: number): string {
    const upperSql = sql.toUpperCase();
    
    // 이미 LIMIT, ROWNUM, FETCH FIRST가 있는 경우
    if (upperSql.includes('LIMIT') || upperSql.includes('ROWNUM') || upperSql.includes('FETCH FIRST')) {
      return sql;
    }

    // ORDER BY가 있는 경우 그 뒤에 LIMIT 추가 (PostgreSQL/MySQL)
    if (upperSql.includes('ORDER BY')) {
      return `${sql} LIMIT ${limit}`;
    }

    // GROUP BY가 있는 경우 그 뒤에 LIMIT 추가
    if (upperSql.includes('GROUP BY')) {
      const groupByIndex = upperSql.lastIndexOf('GROUP BY');
      const havingIndex = upperSql.indexOf('HAVING', groupByIndex);
      
      if (havingIndex !== -1) {
        return `${sql} LIMIT ${limit}`;
      }
      return `${sql} LIMIT ${limit}`;
    }

    // 기본 케이스
    return `${sql} LIMIT ${limit}`;
  }

  /**
   * Oracle 전용 LIMIT 처리 - ROWNUM 래핑
   * Oracle에서는 LIMIT 대신 ROWNUM을 사용해야 함
   */
  addOracleLimit(sql: string, limit: number): string {
    const upperSql = sql.toUpperCase().trim();
    
    // 이미 ROWNUM이 있는 경우
    if (upperSql.includes('ROWNUM')) {
      return sql;
    }

    // FETCH FIRST (Oracle 12c+)가 있는 경우
    if (upperSql.includes('FETCH FIRST')) {
      return sql;
    }

    // ORDER BY가 있는 경우: 서브쿼리로 래핑
    if (upperSql.includes('ORDER BY')) {
      return `SELECT * FROM (${sql}) WHERE ROWNUM <= ${limit}`;
    }

    // 기본 케이스: WHERE 절에 ROWNUM 추가
    if (upperSql.includes('WHERE')) {
      return `${sql} AND ROWNUM <= ${limit}`;
    }
    
    return `${sql} WHERE ROWNUM <= ${limit}`;
  }

  validateWithExplain(explainResult: any): ValidationResult {
    const warnings: string[] = [];

    // PostgreSQL EXPLAIN 결과 분석
    if (explainResult && explainResult[0]) {
      const plan = explainResult[0]['QUERY PLAN'] || JSON.stringify(explainResult[0]);
      
      // Full Table Scan 감지
      if (plan.includes('Seq Scan') || plan.includes('Full Scan')) {
        warnings.push('전체 테이블 스캔(Full Scan)이 감지되었습니다. 성능에 영향을 줄 수 있습니다.');
      }

      // 높은 비용 경고
      const costMatch = plan.match(/cost=[\d.]+\.\.(\d+\.?\d*)/);
      if (costMatch && parseFloat(costMatch[1]) > 10000) {
        warnings.push('쿼리 실행 비용이 높습니다. 대용량 데이터 처리가 예상됩니다.');
      }
    }

    return {
      isValid: true,
      errors: [],
      warnings,
    };
  }
}
