/**
 * SQL Parser Utility
 * SQL 쿼리에서 테이블명을 추출하는 유틸리티
 */

/**
 * SQL 쿼리에서 테이블명을 추출합니다.
 * FROM, JOIN, INTO, UPDATE 등의 키워드 뒤에 오는 테이블명을 찾아냅니다.
 * 
 * @param sql SQL 쿼리 문자열
 * @returns 추출된 테이블명 배열 (중복 제거됨)
 */
export function extractTableNames(sql: string): string[] {
  if (!sql) return [];
  
  // 주석 제거
  let cleanSql = sql
    .replace(/--.*$/gm, '') // 한 줄 주석
    .replace(/\/\*[\s\S]*?\*\//g, ''); // 블록 주석
  
  // 문자열 리터럴 제거 (테이블명으로 혼동될 수 있음)
  // 작은 따옴표는 문자열 리터럴이므로 제거
  cleanSql = cleanSql.replace(/'[^']*'/g, "''");
  // 큰 따옴표는 PostgreSQL/Oracle에서 식별자(테이블/컬럼명)를 감싸므로, 따옴표만 제거하고 내용은 유지
  cleanSql = cleanSql.replace(/"([^"]*)"/g, '$1');
  
  const tables: Set<string> = new Set();
  const cteNames: Set<string> = new Set();
  
  // CTE(WITH절) 이름 추출 - 실제 테이블이 아닌 임시 결과 집합
  // WITH cte_name AS (...), cte_name2 AS (...) 형식
  const ctePattern = /\bWITH\s+(?:RECURSIVE\s+)?(.+?)(?=\s+SELECT\b)/gis;
  let cteMatch: RegExpExecArray | null;
  while ((cteMatch = ctePattern.exec(cleanSql)) !== null) {
    const cteBlock = cteMatch[1];
    // CTE 이름 추출: "name AS ("
    const cteNamePattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi;
    let nameMatch: RegExpExecArray | null;
    while ((nameMatch = cteNamePattern.exec(cteBlock)) !== null) {
      cteNames.add(nameMatch[1].toLowerCase());
    }
  }
  
  // WITH절 내부의 CTE 정의도 찾기 (재귀 및 복잡한 경우)
  const simpleCtePattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi;
  while ((cteMatch = simpleCtePattern.exec(cleanSql)) !== null) {
    cteNames.add(cteMatch[1].toLowerCase());
  }
  
  // 테이블명 패턴: 알파벳, 숫자, 언더스코어, 스키마.테이블 형식
  const tableNamePattern = '[a-zA-Z_][a-zA-Z0-9_]*(?:\\.[a-zA-Z_][a-zA-Z0-9_]*)?';
  
  // FROM 절의 테이블 추출 (메인 테이블 및 서브쿼리 후 별칭 제외)
  const fromPattern = new RegExp(
    `\\bFROM\\s+(${tableNamePattern})(?:\\s+(?:AS\\s+)?[a-zA-Z_][a-zA-Z0-9_]*)?`,
    'gi'
  );
  
  // JOIN 절의 테이블 추출
  const joinPattern = new RegExp(
    `\\b(?:INNER|LEFT|RIGHT|FULL|CROSS|NATURAL)?\\s*(?:OUTER\\s+)?JOIN\\s+(${tableNamePattern})`,
    'gi'
  );
  
  // INSERT INTO 테이블 추출
  const insertPattern = new RegExp(
    `\\bINSERT\\s+INTO\\s+(${tableNamePattern})`,
    'gi'
  );
  
  // UPDATE 테이블 추출
  const updatePattern = new RegExp(
    `\\bUPDATE\\s+(${tableNamePattern})`,
    'gi'
  );
  
  // DELETE FROM 테이블 추출
  const deletePattern = new RegExp(
    `\\bDELETE\\s+FROM\\s+(${tableNamePattern})`,
    'gi'
  );
  
  // 각 패턴으로 테이블명 추출
  let match: RegExpExecArray | null;
  
  while ((match = fromPattern.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase();
    // 서브쿼리나 예약어, CTE 이름 제외
    if (!isReservedWord(tableName) && !cteNames.has(tableName)) {
      tables.add(tableName);
    }
  }
  
  while ((match = joinPattern.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!isReservedWord(tableName) && !cteNames.has(tableName)) {
      tables.add(tableName);
    }
  }
  
  while ((match = insertPattern.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!isReservedWord(tableName) && !cteNames.has(tableName)) {
      tables.add(tableName);
    }
  }
  
  while ((match = updatePattern.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!isReservedWord(tableName) && !cteNames.has(tableName)) {
      tables.add(tableName);
    }
  }
  
  while ((match = deletePattern.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!isReservedWord(tableName) && !cteNames.has(tableName)) {
      tables.add(tableName);
    }
  }
  
  return Array.from(tables);
}

/**
 * SQL 예약어인지 확인
 */
function isReservedWord(word: string): boolean {
  const reserved = new Set([
    'select', 'from', 'where', 'and', 'or', 'not', 'in', 'like', 'between',
    'is', 'null', 'true', 'false', 'as', 'on', 'using', 'join', 'inner',
    'left', 'right', 'full', 'outer', 'cross', 'natural', 'union', 'except',
    'intersect', 'order', 'by', 'group', 'having', 'limit', 'offset', 'fetch',
    'case', 'when', 'then', 'else', 'end', 'exists', 'all', 'any', 'some',
    'distinct', 'top', 'with', 'recursive', 'values', 'set', 'into',
    'insert', 'update', 'delete', 'create', 'alter', 'drop', 'table',
    'index', 'view', 'database', 'schema', 'grant', 'revoke', 'commit',
    'rollback', 'savepoint', 'begin', 'transaction', 'dual', 'lateral'
  ]);
  return reserved.has(word.toLowerCase());
}
