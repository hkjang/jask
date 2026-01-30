import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourcesService } from '../datasources/datasources.service';
import { Client as PgClient } from 'pg';
import * as mysql from 'mysql2/promise';
import oracledb from 'oracledb';
import { LLMService } from '../llm/llm.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { 
  UpdateTableMetadataDto, 
  UpdateColumnMetadataDto, 
  CreateCodeValueDto, 
  UpdateCodeValueDto, 
  CreateRelationshipDto,
  ImportanceLevel,
  SensitivityLevel,
  RelationType
} from './dto/metadata.dto';

interface TableInfo {
  schemaName: string;
  tableName: string;
  description?: string;
  rowCount?: number;
  tableType?: 'TABLE' | 'VIEW' | 'MATERIALIZED_VIEW';  // Object type
  viewDefinition?: string;                              // View SQL definition
}

interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
  description?: string;
}

interface IndexInfo {
  indexName: string;
  columnNames: string[];
  isUnique: boolean;
  isPrimary: boolean;
  indexType?: string;
}

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    private prisma: PrismaService,
    private dataSourcesService: DataSourcesService,
    private llmService: LLMService,
    @Inject(forwardRef(() => EmbeddingService))
    private embeddingService: EmbeddingService,
  ) {}

  async syncMetadata(dataSourceId: string): Promise<{ tables: number; columns: number; indexes: number }> {
    const dataSource = await this.dataSourcesService.findOne(dataSourceId);
    const { client, type } = await this.dataSourcesService.getConnection(dataSourceId);

    let tables: TableInfo[] = [];
    let allColumns: Map<string, ColumnInfo[]> = new Map();
    let allIndexes: Map<string, IndexInfo[]> = new Map();

    if (type === 'postgresql' || dataSource.type === 'postgresql') {
      const result = await this.syncPostgreSQLMetadata(client as PgClient, dataSource.schema || 'public');
      tables = result.tables;
      allColumns = result.columns;
      allIndexes = result.indexes || new Map();
    } else if (type === 'mysql' || dataSource.type === 'mysql') {
      const result = await this.syncMySQLMetadata(client as mysql.Connection, dataSource.database);
      tables = result.tables;
      allColumns = result.columns;
      allIndexes = result.indexes || new Map();
    } else if (type === 'oracle' || dataSource.type === 'oracle') {
      const result = await this.syncOracleMetadata(client as oracledb.Connection, dataSource.schema || dataSource.username?.toUpperCase());
      tables = result.tables;
      allColumns = result.columns;
      allIndexes = result.indexes || new Map();
    }

    // 테이블 저장
    this.logger.debug(`Syncing ${tables.length} tables with column keys: ${Array.from(allColumns.keys()).join(', ')}`);
    
    for (const table of tables) {
      const columnKey = `${table.schemaName}.${table.tableName}`;
      const columnsForTable = allColumns.get(columnKey) || [];
      this.logger.debug(`Table ${table.tableName}: schemaName=${table.schemaName}, key=${columnKey}, columns=${columnsForTable.length}`);
      
      const savedTable = await this.prisma.tableMetadata.upsert({
        where: {
          dataSourceId_schemaName_tableName: {
            dataSourceId,
            schemaName: table.schemaName,
            tableName: table.tableName,
          },
        },
        update: {
          rowCount: table.rowCount,
          tableType: table.tableType || 'TABLE',
          viewDefinition: table.viewDefinition,
        },
        create: {
          dataSourceId,
          schemaName: table.schemaName,
          tableName: table.tableName,
          description: table.description,
          rowCount: table.rowCount,
          tableType: table.tableType || 'TABLE',
          viewDefinition: table.viewDefinition,
        },
      });

      // 컬럼 저장
      const columns = allColumns.get(`${table.schemaName}.${table.tableName}`) || [];
      for (const column of columns) {
        await this.prisma.columnMetadata.upsert({
          where: {
            tableId_columnName: {
              tableId: savedTable.id,
              columnName: column.columnName,
            },
          },
          update: {
            dataType: column.dataType,
            isNullable: column.isNullable,
            isPrimaryKey: column.isPrimaryKey,
            isForeignKey: column.isForeignKey,
            referencedTable: column.referencedTable,
            referencedColumn: column.referencedColumn,
          },
          create: {
            tableId: savedTable.id,
            columnName: column.columnName,
            dataType: column.dataType,
            isNullable: column.isNullable,
            isPrimaryKey: column.isPrimaryKey,
            isForeignKey: column.isForeignKey,
            referencedTable: column.referencedTable,
            referencedColumn: column.referencedColumn,
          },
        });
      }


      // 인덱스 저장
      const indexes = allIndexes.get(`${table.schemaName}.${table.tableName}`) || [];
      for (const idx of indexes) {
        await this.prisma.indexMetadata.upsert({
          where: {
            tableId_indexName: {
              tableId: savedTable.id,
              indexName: idx.indexName,
            },
          },
          update: {
            columnNames: idx.columnNames,
            isUnique: idx.isUnique,
            isPrimary: idx.isPrimary,
            indexType: idx.indexType,
          },
          create: {
            tableId: savedTable.id,
            indexName: idx.indexName,
            columnNames: idx.columnNames,
            isUnique: idx.isUnique,
            isPrimary: idx.isPrimary,
            indexType: idx.indexType,
          },
        });
      }

      // 임베딩 자동 동기화 (비동기로 실행하여 응답 속도 저하 방지)
      this.embeddingService.syncTableEmbedding(savedTable.id).catch(err => {
        this.logger.warn(`Failed to sync embedding for table ${savedTable.tableName}: ${err.message}`);
      });
    }

    const totalColumns = Array.from(allColumns.values()).reduce((sum, cols) => sum + cols.length, 0);
    const totalIndexes = Array.from(allIndexes.values()).reduce((sum, idxs) => sum + idxs.length, 0);
    return { tables: tables.length, columns: totalColumns, indexes: totalIndexes };
  }

  private async syncPostgreSQLMetadata(client: PgClient, schema: string) {
    // 테이블 목록 조회
    const tablesResult = await client.query(`
      SELECT 
        table_schema as schema_name,
        table_name,
        obj_description((quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass, 'pg_class') as description
      FROM information_schema.tables 
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    `, [schema]);

    const tables: TableInfo[] = tablesResult.rows.map((row: any) => ({
      schemaName: row.schema_name,
      tableName: row.table_name,
      description: row.description,
    }));

    // 컬럼 정보 조회
    const columnsResult = await client.query(`
      SELECT 
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
        fk.foreign_table_name as referenced_table,
        fk.foreign_column_name as referenced_column,
        col_description((quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass, c.ordinal_position) as description
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.table_schema, kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_schema = pk.table_schema AND c.table_name = pk.table_name AND c.column_name = pk.column_name
      LEFT JOIN (
        SELECT 
          kcu.table_schema, kcu.table_name, kcu.column_name,
          ccu.table_name as foreign_table_name,
          ccu.column_name as foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
      ) fk ON c.table_schema = fk.table_schema AND c.table_name = fk.table_name AND c.column_name = fk.column_name
      WHERE c.table_schema = $1
      ORDER BY c.table_name, c.ordinal_position
    `, [schema]);

    const columns = new Map<string, ColumnInfo[]>();
    for (const row of columnsResult.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (!columns.has(key)) {
        columns.set(key, []);
      }
      columns.get(key)!.push({
        columnName: row.column_name,
        dataType: row.data_type,
        isNullable: row.is_nullable === 'YES',
        isPrimaryKey: row.is_primary_key,
        isForeignKey: row.is_foreign_key,
        referencedTable: row.referenced_table,
        referencedColumn: row.referenced_column,
        description: row.description,
      });
    }

    // 인덱스 정보 조회
    const indexesResult = await client.query(`
      SELECT
        schemaname as schema_name,
        tablename as table_name,
        indexname as index_name,
        indexdef as index_def
      FROM pg_indexes
      WHERE schemaname = $1
      ORDER BY tablename, indexname
    `, [schema]);

    const indexes = new Map<string, IndexInfo[]>();
    for (const row of indexesResult.rows) {
      const key = `${row.schema_name}.${row.table_name}`;
      if (!indexes.has(key)) {
        indexes.set(key, []);
      }

      // indexdef에서 컬럼명 추출
      const indexDef = row.index_def || '';
      const isPrimary = row.index_name.endsWith('_pkey') || indexDef.toLowerCase().includes('primary key');
      const isUnique = indexDef.toLowerCase().includes('unique') || isPrimary;

      // 컬럼명 추출 (예: CREATE INDEX idx ON table (col1, col2))
      const columnMatch = indexDef.match(/\(([^)]+)\)/);
      let columnNames: string[] = [];
      if (columnMatch) {
        columnNames = columnMatch[1].split(',').map((c: string) => c.trim().replace(/"/g, ''));
      }

      // 인덱스 타입 추출
      let indexType = 'BTREE';
      if (indexDef.toLowerCase().includes('using gin')) indexType = 'GIN';
      else if (indexDef.toLowerCase().includes('using gist')) indexType = 'GIST';
      else if (indexDef.toLowerCase().includes('using hash')) indexType = 'HASH';
      else if (indexDef.toLowerCase().includes('using brin')) indexType = 'BRIN';

      indexes.get(key)!.push({
        indexName: row.index_name,
        columnNames,
        isUnique,
        isPrimary,
        indexType,
      });
    }

    return { tables, columns, indexes };
  }

  private async syncMySQLMetadata(client: mysql.Connection, database: string) {
    // 테이블 목록 조회
    const [tablesRows] = await client.query(`
      SELECT 
        TABLE_SCHEMA as schema_name,
        TABLE_NAME as table_name,
        TABLE_COMMENT as description,
        TABLE_ROWS as row_count
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
    `, [database]) as any;

    const tables: TableInfo[] = tablesRows.map((row: any) => ({
      schemaName: row.schema_name,
      tableName: row.table_name,
      description: row.description || undefined,
      rowCount: row.row_count,
    }));

    // 컬럼 정보 조회
    const [columnsRows] = await client.query(`
      SELECT 
        c.TABLE_SCHEMA as table_schema,
        c.TABLE_NAME as table_name,
        c.COLUMN_NAME as column_name,
        c.DATA_TYPE as data_type,
        c.IS_NULLABLE as is_nullable,
        c.COLUMN_KEY as column_key,
        c.COLUMN_COMMENT as description,
        kcu.REFERENCED_TABLE_NAME as referenced_table,
        kcu.REFERENCED_COLUMN_NAME as referenced_column
      FROM information_schema.COLUMNS c
      LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu 
        ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA 
        AND c.TABLE_NAME = kcu.TABLE_NAME 
        AND c.COLUMN_NAME = kcu.COLUMN_NAME
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      WHERE c.TABLE_SCHEMA = ?
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `, [database]) as any;

    const columns = new Map<string, ColumnInfo[]>();
    for (const row of columnsRows) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (!columns.has(key)) {
        columns.set(key, []);
      }
      columns.get(key)!.push({
        columnName: row.column_name,
        dataType: row.data_type,
        isNullable: row.is_nullable === 'YES',
        isPrimaryKey: row.column_key === 'PRI',
        isForeignKey: !!row.referenced_table,
        referencedTable: row.referenced_table,
        referencedColumn: row.referenced_column,
        description: row.description || undefined,
      });
    }

    // 인덱스 정보 조회
    const [indexesRows] = await client.query(`
      SELECT
        TABLE_SCHEMA as table_schema,
        TABLE_NAME as table_name,
        INDEX_NAME as index_name,
        NON_UNIQUE as non_unique,
        COLUMN_NAME as column_name,
        SEQ_IN_INDEX as seq_in_index,
        INDEX_TYPE as index_type
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `, [database]) as any;

    const indexes = new Map<string, IndexInfo[]>();
    const indexMap = new Map<string, { columns: string[], isUnique: boolean, isPrimary: boolean, indexType: string }>();

    for (const row of indexesRows) {
      const key = `${row.table_schema}.${row.table_name}`;
      const indexKey = `${key}.${row.index_name}`;

      if (!indexMap.has(indexKey)) {
        indexMap.set(indexKey, {
          columns: [],
          isUnique: row.non_unique === 0,
          isPrimary: row.index_name === 'PRIMARY',
          indexType: row.index_type || 'BTREE'
        });
      }
      indexMap.get(indexKey)!.columns.push(row.column_name);
    }

    for (const [indexKey, data] of indexMap.entries()) {
      const [schema, tableName, indexName] = indexKey.split('.');
      const key = `${schema}.${tableName}`;

      if (!indexes.has(key)) {
        indexes.set(key, []);
      }
      indexes.get(key)!.push({
        indexName,
        columnNames: data.columns,
        isUnique: data.isUnique,
        isPrimary: data.isPrimary,
        indexType: data.indexType,
      });
    }

    return { tables, columns, indexes };
  }

  private async syncOracleMetadata(client: oracledb.Connection, schema: string) {
    // Oracle: Normalize schema to uppercase (Oracle is case-insensitive for identifiers)
    const normalizedSchema = schema?.toUpperCase() || '';
    
    // 1. Get table list from ALL_TABLES
    const tablesResult = await client.execute(
      `SELECT 
         TABLE_NAME as table_name,
         NUM_ROWS as row_count,
         'TABLE' as table_type
       FROM ALL_TABLES 
       WHERE OWNER = :schema`,
      { schema: normalizedSchema },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const tables: TableInfo[] = (tablesResult.rows || []).map((row: any) => ({
      schemaName: normalizedSchema,
      tableName: row.TABLE_NAME,
      rowCount: row.ROW_COUNT,
      tableType: 'TABLE' as const,
    }));

    // 2. Get view list from ALL_VIEWS (including view SQL definition)
    this.logger.log(`Fetching views for schema: ${normalizedSchema}`);
    try {
      const viewsResult = await client.execute(
        `SELECT 
           VIEW_NAME,
           TEXT as VIEW_DEFINITION
         FROM ALL_VIEWS 
         WHERE OWNER = :schema`,
        { schema: normalizedSchema },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const views: TableInfo[] = (viewsResult.rows || []).map((row: any) => {
        // Oracle stores TEXT as CLOB, need to handle it properly
        let viewDef = row.VIEW_DEFINITION;
        if (viewDef && typeof viewDef === 'object' && viewDef.getData) {
          // Handle CLOB object
          viewDef = viewDef.getData ? viewDef.getData() : String(viewDef);
        }
        return {
          schemaName: normalizedSchema,
          tableName: row.VIEW_NAME,
          tableType: 'VIEW' as const,
          viewDefinition: viewDef ? String(viewDef).substring(0, 4000) : undefined,
        };
      });

      this.logger.log(`Found ${views.length} views in schema ${normalizedSchema}`);
      tables.push(...views);
    } catch (viewError) {
      this.logger.warn(`Failed to fetch views for schema ${normalizedSchema}: ${viewError.message}`);
      // Continue even if view fetch fails
    }

    // Get column info
    const columnsResult = await client.execute(
      `SELECT 
         c.TABLE_NAME,
         c.COLUMN_NAME,
         c.DATA_TYPE,
         c.NULLABLE,
         CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'Y' ELSE 'N' END as IS_PK,
         CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 'Y' ELSE 'N' END as IS_FK,
         fk.R_TABLE_NAME as REFERENCED_TABLE,
         fk.R_COLUMN_NAME as REFERENCED_COLUMN
       FROM ALL_TAB_COLUMNS c
       LEFT JOIN (
         SELECT acc.TABLE_NAME, acc.COLUMN_NAME
         FROM ALL_CONS_COLUMNS acc
         JOIN ALL_CONSTRAINTS ac ON acc.CONSTRAINT_NAME = ac.CONSTRAINT_NAME AND acc.OWNER = ac.OWNER
         WHERE ac.CONSTRAINT_TYPE = 'P' AND ac.OWNER = :schema
       ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
       LEFT JOIN (
         SELECT acc.TABLE_NAME, acc.COLUMN_NAME, 
                acc2.TABLE_NAME as R_TABLE_NAME, acc2.COLUMN_NAME as R_COLUMN_NAME
         FROM ALL_CONS_COLUMNS acc
         JOIN ALL_CONSTRAINTS ac ON acc.CONSTRAINT_NAME = ac.CONSTRAINT_NAME AND acc.OWNER = ac.OWNER
         JOIN ALL_CONS_COLUMNS acc2 ON ac.R_CONSTRAINT_NAME = acc2.CONSTRAINT_NAME AND ac.R_OWNER = acc2.OWNER
         WHERE ac.CONSTRAINT_TYPE = 'R' AND ac.OWNER = :schema
       ) fk ON c.TABLE_NAME = fk.TABLE_NAME AND c.COLUMN_NAME = fk.COLUMN_NAME
       WHERE c.OWNER = :schema
       ORDER BY c.TABLE_NAME, c.COLUMN_ID`,
      { schema: normalizedSchema },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const columns = new Map<string, ColumnInfo[]>();
    for (const row of (columnsResult.rows || []) as any[]) {
      const key = `${normalizedSchema}.${row.TABLE_NAME}`;
      if (!columns.has(key)) {
        columns.set(key, []);
      }
      columns.get(key)!.push({
        columnName: row.COLUMN_NAME,
        dataType: row.DATA_TYPE,
        isNullable: row.NULLABLE === 'Y',
        isPrimaryKey: row.IS_PK === 'Y',
        isForeignKey: row.IS_FK === 'Y',
        referencedTable: row.REFERENCED_TABLE,
        referencedColumn: row.REFERENCED_COLUMN,
      });
    }

    // 인덱스 정보 조회
    const indexesResult = await client.execute(
      `SELECT
         i.TABLE_NAME,
         i.INDEX_NAME,
         i.UNIQUENESS,
         ic.COLUMN_NAME,
         ic.COLUMN_POSITION,
         i.INDEX_TYPE,
         CASE WHEN c.CONSTRAINT_TYPE = 'P' THEN 'Y' ELSE 'N' END as IS_PRIMARY
       FROM ALL_INDEXES i
       JOIN ALL_IND_COLUMNS ic ON i.OWNER = ic.INDEX_OWNER AND i.INDEX_NAME = ic.INDEX_NAME
       LEFT JOIN ALL_CONSTRAINTS c ON i.INDEX_NAME = c.INDEX_NAME AND i.OWNER = c.OWNER AND c.CONSTRAINT_TYPE = 'P'
       WHERE i.OWNER = :schema AND i.TABLE_OWNER = :schema
       ORDER BY i.TABLE_NAME, i.INDEX_NAME, ic.COLUMN_POSITION`,
      { schema: normalizedSchema },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const indexes = new Map<string, IndexInfo[]>();
    const indexMap = new Map<string, { columns: string[], isUnique: boolean, isPrimary: boolean, indexType: string }>();

    for (const row of (indexesResult.rows || []) as any[]) {
      const key = `${normalizedSchema}.${row.TABLE_NAME}`;
      const indexKey = `${key}.${row.INDEX_NAME}`;

      if (!indexMap.has(indexKey)) {
        indexMap.set(indexKey, {
          columns: [],
          isUnique: row.UNIQUENESS === 'UNIQUE',
          isPrimary: row.IS_PRIMARY === 'Y',
          indexType: row.INDEX_TYPE || 'NORMAL'
        });
      }
      indexMap.get(indexKey)!.columns.push(row.COLUMN_NAME);
    }

    for (const [indexKey, data] of indexMap.entries()) {
      const parts = indexKey.split('.');
      const indexName = parts.pop()!;
      const tableName = parts.pop()!;
      const schemaName = parts.join('.');
      const key = `${schemaName}.${tableName}`;

      if (!indexes.has(key)) {
        indexes.set(key, []);
      }
      indexes.get(key)!.push({
        indexName,
        columnNames: data.columns,
        isUnique: data.isUnique,
        isPrimary: data.isPrimary,
        indexType: data.indexType,
      });
    }

    return { tables, columns, indexes };
  }

  async getTables(dataSourceId: string) {
    return this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: false },
      include: { 
        columns: {
          orderBy: { columnName: 'asc' }
        },
        relationshipsFrom: true,
        relationshipsTo: true
      },
      orderBy: { tableName: 'asc' }
    });
  }

  async getTableWithColumns(tableId: string) {
    return this.prisma.tableMetadata.findUnique({
      where: { id: tableId },
      include: { 
        columns: {
          orderBy: { columnName: 'asc' }
        }
      }
    });
  }

  async previewTableData(tableId: string, limit: number = 10) {
    const table = await this.prisma.tableMetadata.findUnique({
      where: { id: tableId }
    });
    if (!table) throw new Error('Table not found');

    const { dataSourceId, schemaName, tableName } = table;
    const { client, type } = await this.dataSourcesService.getConnection(dataSourceId);

    try {
      if (type === 'postgresql') {
        const query = `SELECT * FROM "${schemaName}"."${tableName}" LIMIT $1`;
        const res = await (client as PgClient).query(query, [limit]);
        return res.rows;
      } else if (type === 'mysql') {
        const query = `SELECT * FROM ${tableName} LIMIT ?`;
        const [rows] = await (client as mysql.Connection).query(query, [limit]);
        return rows;
      } else if (type === 'oracle') {
        // Oracle: 접속 사용자와 테이블 소유자(OWNER)가 다를 수 있으므로 폴백 로직 적용
        const oracleClient = client as oracledb.Connection;
        
        // 시도 1: OWNER.TABLE 형식 (정규화된 이름)
        try {
          const query = `SELECT * FROM "${schemaName}"."${tableName}" WHERE ROWNUM <= :limit`;
          this.logger.debug(`Oracle preview attempt 1: ${query}`);
          const result = await oracleClient.execute(
            query,
            { limit },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          return this.sanitizeOracleRows(result.rows || []);
        } catch (ownerError: any) {
          // ORA-00942: table or view does not exist (권한 없거나 테이블 없음)
          // ORA-01031: insufficient privileges
          const isPermissionError = ownerError.errorNum === 942 || ownerError.errorNum === 1031;
          
          if (isPermissionError) {
            this.logger.warn(`Oracle preview with OWNER failed for "${schemaName}"."${tableName}": ${ownerError.message}. Trying without schema prefix...`);
            
            // 시도 2: 테이블명만 사용 (동의어 또는 현재 스키마)
            try {
              const fallbackQuery = `SELECT * FROM "${tableName}" WHERE ROWNUM <= :limit`;
              this.logger.debug(`Oracle preview attempt 2 (fallback): ${fallbackQuery}`);
              const fallbackResult = await oracleClient.execute(
                fallbackQuery,
                { limit },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
              );
              return this.sanitizeOracleRows(fallbackResult.rows || []);
            } catch (fallbackError: any) {
              // 시도 3: 스키마명 없이 대문자가 아닌 형태로 재시도 (혼합 케이스 테이블)
              try {
                const mixedCaseQuery = `SELECT * FROM ${tableName} WHERE ROWNUM <= :limit`;
                this.logger.debug(`Oracle preview attempt 3 (mixed case): ${mixedCaseQuery}`);
                const mixedCaseResult = await oracleClient.execute(
                  mixedCaseQuery,
                  { limit },
                  { outFormat: oracledb.OUT_FORMAT_OBJECT }
                );
                return this.sanitizeOracleRows(mixedCaseResult.rows || []);
              } catch (finalError: any) {
                // 모든 시도 실패 - 상세한 에러 메시지 반환
                this.logger.error(`Oracle preview failed for ${schemaName}.${tableName}: All attempts failed`);
                const errorDetails = this.formatOraclePreviewError(ownerError.errorNum, schemaName, tableName);
                throw new Error(errorDetails);
              }
            }
          }
          // 권한 문제가 아닌 다른 오류는 그대로 전파
          throw ownerError;
        }
      }
    } catch (error: any) {
      this.logger.error(`Preview failed for ${tableName}: ${error.message}`);
      // 이미 포맷된 에러 메시지면 그대로 사용, 아니면 일반 메시지
      if (error.message.includes('데이터 미리보기 실패') || error.message.includes('권한')) {
        throw error;
      }
      throw new Error(`데이터 미리보기 실패: ${error.message}`);
    }
  }

  /**
   * Oracle 결과 행을 JSON 직렬화 가능한 일반 객체로 변환
   * Oracle의 NVPair 객체는 순환 참조를 포함하여 JSON.stringify 시 오류 발생
   * LOB 데이터는 비동기로 읽어서 실제 내용을 표시
   */
  private async sanitizeOracleRows(rows: any[]): Promise<any[]> {
    const sanitizedRows: any[] = [];
    
    for (const row of rows) {
      const sanitizedRow: Record<string, any> = {};
      for (const key of Object.keys(row)) {
        const value = row[key];
        sanitizedRow[key] = await this.sanitizeOracleValue(value);
      }
      sanitizedRows.push(sanitizedRow);
    }
    
    return sanitizedRows;
  }

  /**
   * Oracle 개별 값을 JSON 직렬화 가능한 형태로 변환
   */
  private async sanitizeOracleValue(value: any): Promise<any> {
    // null/undefined 처리
    if (value === null || value === undefined) {
      return value;
    }
    
    // LOB (CLOB/BLOB) 객체 처리 - oracledb의 Lob 클래스
    if (typeof value === 'object' && value.constructor && value.constructor.name === 'Lob') {
      try {
        // LOB 데이터를 문자열로 읽기
        const lobData = await this.readOracleLob(value);
        // 미리보기이므로 최대 500자까지만 표시
        if (typeof lobData === 'string' && lobData.length > 500) {
          return lobData.substring(0, 500) + '... (truncated)';
        }
        return lobData;
      } catch (err: any) {
        this.logger.warn(`Failed to read LOB data: ${err.message}`);
        return '[LOB 읽기 실패]';
      }
    }
    
    // getData 메서드가 있는 객체 (일부 Oracle 타입)
    if (typeof value === 'object' && typeof value.getData === 'function') {
      try {
        const data = await value.getData();
        if (typeof data === 'string' && data.length > 500) {
          return data.substring(0, 500) + '... (truncated)';
        }
        return data;
      } catch {
        return '[데이터 읽기 실패]';
      }
    }
    
    // Date 객체
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // Buffer (BLOB 등)
    if (Buffer.isBuffer(value)) {
      // 작은 바이너리는 Base64로 표시, 큰 것은 크기만 표시
      if (value.length <= 100) {
        return `[Binary: ${value.toString('base64').substring(0, 50)}...]`;
      }
      return `[Binary data: ${value.length} bytes]`;
    }
    
    // 기타 객체
    if (typeof value === 'object') {
      try {
        // 순환 참조 체크 후 변환
        return JSON.parse(JSON.stringify(value));
      } catch {
        return String(value);
      }
    }
    
    // 기본 타입은 그대로 반환
    return value;
  }

  /**
   * Oracle LOB 객체에서 데이터 읽기
   */
  private readOracleLob(lob: any): Promise<string> {
    return new Promise((resolve, reject) => {
      // LOB 타입 로깅
      this.logger.debug(`Reading LOB: type=${lob.type}`);
      
      // LOB 타입 확인
      // DB_TYPE_CLOB = 2017, DB_TYPE_NCLOB = 2019, DB_TYPE_BLOB = 2007
      // 또는 구버전: CLOB = 112, BLOB = 113
      const isClob = lob.type === 2017 || lob.type === 2019 || lob.type === 112;
      
      if (isClob) {
        // CLOB: 문자열로 수집
        let content = '';
        lob.setEncoding('utf8');
        lob.on('data', (chunk: string) => {
          content += chunk;
          // 미리보기이므로 1000자 이상이면 중단
          if (content.length > 1000) {
            lob.destroy();
            resolve(content.substring(0, 1000) + '... (truncated)');
          }
        });
        lob.on('end', () => resolve(content));
        lob.on('error', (err: any) => reject(err));
      } else {
        // BLOB: 바이너리 수집 후 텍스트 변환 시도
        const chunks: Buffer[] = [];
        let totalSize = 0;
        
        lob.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          totalSize += chunk.length;
          // 미리보기이므로 10KB 이상이면 중단
          if (totalSize > 10240) {
            lob.destroy();
            resolve(`[BLOB: ${totalSize}+ bytes - 너무 큼]`);
          }
        });
        
        lob.on('end', () => {
          const buffer = Buffer.concat(chunks);
          // 작은 BLOB은 텍스트로 변환 시도
          if (buffer.length <= 1000) {
            try {
              const text = buffer.toString('utf8');
              // 유효한 텍스트인지 확인 (제어 문자가 거의 없는지)
              const controlChars = text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
              if (!controlChars || controlChars.length < text.length * 0.1) {
                resolve(text);
                return;
              }
            } catch {
              // UTF-8 변환 실패
            }
          }
          resolve(`[BLOB: ${buffer.length} bytes]`);
        });
        
        lob.on('error', (err: any) => reject(err));
      }
    });
  }

  /**
   * Oracle 미리보기 에러 메시지 포맷
   */
  private formatOraclePreviewError(errorNum: number, schemaName: string, tableName: string): string {
    switch (errorNum) {
      case 942:
        return `데이터 미리보기 실패: 테이블 "${schemaName}"."${tableName}"에 접근할 수 없습니다. ` +
               `현재 접속 사용자에게 해당 테이블에 대한 SELECT 권한이 없거나, 테이블이 존재하지 않습니다. ` +
               `관리자에게 "GRANT SELECT ON ${schemaName}.${tableName} TO [접속사용자]" 권한 부여를 요청하세요.`;
      case 1031:
        return `데이터 미리보기 실패: 권한이 부족합니다. ` +
               `테이블 "${schemaName}"."${tableName}"에 대한 SELECT 권한이 필요합니다. ` +
               `관리자에게 권한 부여를 요청하세요.`;
      default:
        return `데이터 미리보기 실패: Oracle 에러 (ORA-${String(errorNum).padStart(5, '0')}). ` +
               `테이블: "${schemaName}"."${tableName}"`;
    }
  }

  async calculateAndSaveQualityScore(tableId: string) {
    const table = await this.prisma.tableMetadata.findUnique({
        where: { id: tableId },
        include: { columns: { include: { codeValueList: true } }, relationshipsFrom: true, relationshipsTo: true }
    });
    if (!table) return null;

    let totalPoints = 0;
    let earnedPoints = 0;

    // 1. Description (20 pts)
    totalPoints += 20;
    if (table.description && table.description.length > 5) {
        earnedPoints += 20;
    }

    // 2. Semantic Names for Columns (30 pts)
    const cols = table.columns.filter(c => c.sensitivityLevel !== 'STRICT'); // Ignore strict cols
    if (cols.length > 0) {
        const pointPerCol = 30 / cols.length;
        let colPoints = 0;
        cols.forEach(c => {
            if (c.semanticName) colPoints += pointPerCol;
        });
        totalPoints += 30; // Max 30
        earnedPoints += colPoints;
    }

    // 3. Foreign Keys Defined? (or Relationships) (20 pts)
    // If table looks like it should have FKs (e.g. has _id columns not PK), check if relation exists.
    // For simplicity: If there's at least one relationship (to or from), give points. or if no relationships needed, give points.
    // Let's rely on explicit logical relationships.
    totalPoints += 20;
    const hasRelationships = table.relationshipsFrom.length > 0 || table.relationshipsTo.length > 0;
    // Or if it's a simple lookup table?
    if (hasRelationships) {
        earnedPoints += 20;
    } else {
        // Maybe it doesn't need them. Check for "id" columns
        const potentialFks = cols.filter(c => c.columnName.toLowerCase().endsWith('id') && !c.isPrimaryKey);
        if (potentialFks.length === 0) earnedPoints += 20; // Probably standalone table
        else earnedPoints += 0; // Missing relationships for Id columns
    }

    // 4. Code Values (20 pts)
    // If any column isCode, must have values.
    const codeCols = cols.filter(c => c.isCode);
    if (codeCols.length > 0) {
        totalPoints += 20;
        const validCodeCols = codeCols.filter(c => c.codeValueList.length > 0);
        earnedPoints += (validCodeCols.length / codeCols.length) * 20;
    } else {
        // No codes needed
        totalPoints += 20;
        earnedPoints += 20;
    }

    // 5. Sensitivity (10 pts)
    // Always give full points if default is sane? 
    // Let's say if NOT everything is DEFAULT ("INTERNAL"), assume reviewed.
    // Or just give free points for now.
    totalPoints += 10;
    earnedPoints += 10;


    const score = Math.round((earnedPoints / totalPoints) * 100);
    
    // Status Logic
    let status = table.metadataStatus;
    if (score >= 90) status = 'VERIFIED'; // Suggestion
    else if (score >= 50 && status === 'DRAFT') status = 'PENDING_REVIEW'; // Suggestion

    const result = await this.prisma.tableMetadata.update({
        where: { id: tableId },
        data: { completenessScore: score, metadataStatus: status }
    });

    return { score, status: result.metadataStatus, details: { earnedPoints, totalPoints } };
  }

  // 전체 테이블 품질 점수 재계산
  async recalculateAllScores(dataSourceId: string) {
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId },
      select: { id: true, tableName: true }
    });

    let processed = 0;
    let failed = 0;

    for (const table of tables) {
      try {
        await this.calculateAndSaveQualityScore(table.id);
        processed++;
        this.logger.log(`Recalculated score for table ${table.tableName}`);
      } catch (error) {
        failed++;
        this.logger.error(`Failed to recalculate score for table ${table.tableName}: ${error.message}`);
      }
    }

    return { success: true, processed, failed, total: tables.length };
  }

  async getSchemaContext(dataSourceId: string): Promise<string> {
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: false },
      include: {
        columns: {
          where: { isExcluded: false }, // AI 컨텍스트에서 제외된 컬럼 필터링
          include: {
            codeValueList: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' }
            }
          }
        },
        relationshipsFrom: { include: { targetTable: true } }, // outgoing relationships
        relationshipsTo: { include: { sourceTable: true } }    // incoming relationships
      },
      orderBy: { tableName: 'asc' }
    });

    let context = '';
    for (const table of tables) {
      if (table.importanceLevel === 'LOW') continue; // Skip low importance tables in context to save tokens? Or just use it for ranking. For now include all not excluded.

      // Display table/view type
      const objectType = table.tableType === 'VIEW' ? 'View' : 
                         table.tableType === 'MATERIALIZED_VIEW' ? 'Materialized View' : 'Table';
      context += `\n${objectType}: ${table.schemaName}.${table.tableName}`;
      if (table.tableType === 'VIEW') context += ' [VIEW]';
      if (table.description) context += ` -- ${table.description}`;
      if (table.tags && table.tags.length > 0) context += ` (Tags: ${table.tags.join(', ')})`;
      context += '\n';

      // Include view definition for better SQL generation context
      if (table.tableType === 'VIEW' && table.viewDefinition) {
        const truncatedDef = table.viewDefinition.length > 500 
          ? table.viewDefinition.substring(0, 500) + '...' 
          : table.viewDefinition;
        context += `  View Definition: ${truncatedDef}\n`;
      }

      // Relations
      const relations = [
        ...table.relationshipsFrom.map(r => `Logical Relation: -> ${r.targetTable.tableName} (${r.description || r.relationType})`),
        ...table.relationshipsTo.map(r => `Logical Relation: <- ${r.sourceTable.tableName} (${r.description || r.relationType})`)
      ];
      if (relations.length > 0) {
        context += `Relationships:\n${relations.map(r => `  ${r}`).join('\n')}\n`;
      }

      context += 'Columns:\n';
      for (const col of table.columns) {
        // Skip excluded or strict sensitivity columns
        if (col.isExcluded || col.sensitivityLevel === SensitivityLevel.STRICT) continue;

        context += `  - ${col.columnName}`;
        if (col.semanticName) context += ` ("${col.semanticName}")`;
        context += ` (${col.dataType})`;
        
        if (col.unit) context += ` [Unit: ${col.unit}]`;
        if (col.isPrimaryKey) context += ' [PK]';
        if (col.isForeignKey) context += ` [FK -> ${col.referencedTable}.${col.referencedColumn}]`;
        if (col.description) context += ` -- ${col.description}`;
        
        // Code Values
        if (col.isCode && col.codeValueList && col.codeValueList.length > 0) {
          const codes = col.codeValueList.map(cv => `${cv.code}=${cv.value}`).join(', ');
          context += `\n    Allowed Values: { ${codes} }`;
        }
        context += '\n';
      }
    }

    return context;
  }

  async searchSchemaContext(dataSourceId: string, question: string, limit: number = 20): Promise<{ context: string; tables: string[] }> {
    try {
      // 1. Generate embedding for the question
      const embedding = await this.llmService.generateEmbedding(question);
      const vectorStr = `[${embedding.join(',')}]`;

      // 2. Boost View Tables: Find views that may be relevant to the question
      const questionLower = question.toLowerCase();
      const viewTables = await this.prisma.tableMetadata.findMany({
        where: {
          dataSourceId,
          tableType: 'VIEW',
          isExcluded: false
        },
        include: {
          columns: {
            where: { isExcluded: false }, // AI 컨텍스트에서 제외된 컬럼 필터링
            include: { codeValueList: { where: { isActive: true } } }
          }
        }
      });

      // Find views that match by name, description, or column names
      const matchedViews = viewTables.filter(view => {
        const viewNameLower = view.tableName.toLowerCase();
        const descLower = (view.description || '').toLowerCase();
        const columnNames = view.columns.map(c => c.columnName.toLowerCase()).join(' ');
        
        // Check if question references the view
        return questionLower.includes(viewNameLower) || 
               viewNameLower.includes(questionLower.split(' ')[0]) ||
               descLower.split(' ').some(word => word.length > 3 && questionLower.includes(word)) ||
               view.columns.some(c => c.semanticName && questionLower.includes(c.semanticName.toLowerCase()));
      });

      // 3. Build View Context (prioritized)
      const selectedTables: string[] = [];
      let viewContext = '';
      if (matchedViews.length > 0) {
        this.logger.log(`[View Boost] Found ${matchedViews.length} relevant views for question: "${question.substring(0, 50)}..."`);
        viewContext = '=== 추천 뷰 테이블 (질문과 유사) ===\n\n';
        
        for (const view of matchedViews) {
          selectedTables.push(view.tableName);
          viewContext += `View: ${view.schemaName}.${view.tableName} [VIEW]`;
          if (view.description) viewContext += ` -- ${view.description}`;
          viewContext += '\n';
          
          // Include view definition for better SQL generation
          if (view.viewDefinition) {
            const truncatedDef = view.viewDefinition.length > 500 
              ? view.viewDefinition.substring(0, 500) + '...' 
              : view.viewDefinition;
            viewContext += `  View Definition: ${truncatedDef}\n`;
          }
          
          viewContext += 'Columns:\n';
          for (const col of view.columns) {
            viewContext += `  - ${col.columnName}`;
            if (col.semanticName) viewContext += ` ("${col.semanticName}")`;
            viewContext += ` (${col.dataType})`;
            if (col.description) viewContext += ` -- ${col.description}`;
            viewContext += '\n';
          }
          viewContext += '\n';
        }
        viewContext += '=== 기타 관련 스키마 ===\n\n';
      }

      // 4. Perform Vector Search for remaining tables (exclude tables marked as excluded)
      const results = await this.prisma.$queryRaw<any[]>`
        SELECT t."tableName", s."content",
               (s."embedding" <=> ${vectorStr}::vector) as distance
        FROM "SchemaEmbedding" s
        JOIN "TableMetadata" t ON s."tableId" = t."id"
        WHERE t."dataSourceId" = ${dataSourceId}
          AND t."isExcluded" = false
        ORDER BY distance ASC
        LIMIT ${limit * 2}
      `;

      if (!results || results.length === 0) {
        if (viewContext) {
          // Return only view context if no vector results
          return { context: viewContext, tables: selectedTables };
        }
        this.logger.warn(`No vector search results found for DataSource ${dataSourceId}. Falling back to full schema.`);
        const fullContext = await this.getSchemaContext(dataSourceId);
        return { context: fullContext, tables: [] };
      }

      // 5. Construct Context from results (with view context prepended)
      let context = viewContext;
      if (!viewContext) {
        context = 'Selected Schema (based on relevance):\n\n';
      }
      
      for (const row of results) {
        if (selectedTables.length >= limit) break;

        // Filter system tables
        if (row.tableName.startsWith('_') || row.tableName.startsWith('pg_')) continue;

        // Skip if this table was already included as a matched view
        const isAlreadyIncluded = matchedViews.some(v => v.tableName === row.tableName);
        if (isAlreadyIncluded) continue;

        // Relevance Threshold with Minimum Guarantee
        // Allow top 3 matches regardless of score (to avoid empty context), then enforce strict threshold (0.55)
        if (row.distance > 0.55 && selectedTables.length >= 3) continue;

        context += `${row.content}\n\n`;
        selectedTables.push(row.tableName);
      }
      
      return { context, tables: selectedTables };

    } catch (error) {
       this.logger.error(`Vector search failed: ${error.message}. Falling back to full schema.`);
       const fullContext = await this.getSchemaContext(dataSourceId);
       return { context: fullContext, tables: [] };
    }
  }

  async getTableInfoByName(dataSourceId: string, tableName: string) {
    // Check if tableName has schema (e.g. public.users)
    let table = tableName;
    let schemaSchema: string | undefined;
    
    if (tableName.includes('.')) {
        const parts = tableName.split('.');
        if (parts.length === 2) {
             table = parts[1];
             schemaSchema = parts[0];
        }
    }
    
    // Find table
    const where: any = {
        dataSourceId,
        tableName: { equals: table, mode: 'insensitive' }
    };
    
    if (schemaSchema) {
        where.schemaName = { equals: schemaSchema, mode: 'insensitive' };
    }

    const found = await this.prisma.tableMetadata.findFirst({
        where,
        include: {
            columns: {
               orderBy: { columnName: 'asc' },
               include: { codeValueList: true }
            }
        }
    });

    return found;
  }

  // ===========================================
  // Simulation Helper - Detailed Schema Search
  // ===========================================
  async searchSchemaContextWithDetails(dataSourceId: string, question: string, limit: number = 20) {
    const startTime = Date.now();
    
    try {
      // 1. Generate embedding for the question
      const embeddingStartTime = Date.now();
      const embedding = await this.llmService.generateEmbedding(question);
      const embeddingTime = Date.now() - embeddingStartTime;
      const vectorStr = `[${embedding.join(',')}]`;

      // 2. Perform Vector Search for tables with scores
      const searchStartTime = Date.now();
      const results = await this.prisma.$queryRaw<any[]>`
        SELECT t."id", t."tableName", t."schemaName", t."description", s."content", 
               (1 - (s."embedding" <=> ${vectorStr}::vector)) as similarity
        FROM "SchemaEmbedding" s
        JOIN "TableMetadata" t ON s."tableId" = t."id"
        WHERE t."dataSourceId" = ${dataSourceId} AND t."isExcluded" = false
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;
      const searchTime = Date.now() - searchStartTime;

      // 3. Build context
      let context = '';
      const selectedTables: { tableName: string; schemaName: string; similarity: number; description?: string }[] = [];
      
      for (const row of results) {
        selectedTables.push({
          tableName: row.tableName,
          schemaName: row.schemaName,
          similarity: parseFloat(row.similarity?.toFixed(4) || '0'),
          description: row.description
        });
        context += `${row.content}\n\n`;
      }

      const totalTime = Date.now() - startTime;

      return {
        success: true,
        embedding: {
          dimensions: embedding.length,
          timeMs: embeddingTime
        },
        search: {
          selectedTables,
          totalFound: results.length,
          timeMs: searchTime
        },
        context: context.trim(),
        totalTimeMs: totalTime
      };

    } catch (error) {
      this.logger.error(`Detailed schema search failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        context: await this.getSchemaContext(dataSourceId),
        embedding: null,
        search: null,
        totalTimeMs: Date.now() - startTime
      };
    }
  }

  // ===========================================
  // Recommendation Helper
  // ===========================================
  async getReviewableSchemaContext(dataSourceId: string, limit: number = 20): Promise<string> {
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: false },
      include: {
        columns: {
          where: { isExcluded: false }, // AI 컨텍스트에서 제외된 컬럼 필터링
        },
      },
    });

    // Custom Sort: CRITICAL > HIGH > MEDIUM > LOW
    const score = (level: string) => {
      switch (level) {
        case 'CRITICAL': return 3;
        case 'HIGH': return 2;
        case 'MEDIUM': return 1;
        default: return 0;
      }
    };

    tables.sort((a, b) => score(b.importanceLevel) - score(a.importanceLevel));

    // Pick top tables and maybe throw in a few random ones for diversity? 
    // For now, just top N.
    const selectedTables = tables.slice(0, limit);

    let context = '';
    for (const table of selectedTables) {
      context += `\nTable: ${table.schemaName}.${table.tableName}`;
      if (table.description) context += ` -- ${table.description}`;
      context += '\nColumns: ' + table.columns.map(c => c.columnName + (c.semanticName ? `(${c.semanticName})` : '')).join(', ') + '\n';
    }
    
    return context;
  }

  // ===========================================
  // Extended Metadata Methods
  // ===========================================

  async updateTableExtendedMetadata(tableId: string, dto: UpdateTableMetadataDto & any) {
    const updated = await this.prisma.tableMetadata.update({
      where: { id: tableId },
      data: {
        description: dto.description,
        tags: dto.tags,
        // Cast string enum from DTO to Prisma enum type if strictly needed, but usually compatible.
        importanceLevel: dto.importanceLevel as any,
        isSyncedWithAI: dto.isSyncedWithAI,
        isExcluded: dto.isExcluded,
        reviewNotes: dto.reviewNotes,
        metadataStatus: dto.metadataStatus as any
      },
    });
    // Recalculate score after update?
    // Optimization: separate call or async event. For now, let's keep it manual or implicit.
    // actually, let's trigger it.
    await this.calculateAndSaveQualityScore(tableId);
    return updated;
  }

  async updateColumnExtendedMetadata(columnId: string, dto: UpdateColumnMetadataDto) {
    return this.prisma.columnMetadata.update({
      where: { id: columnId },
      data: {
        description: dto.description,
        semanticName: dto.semanticName,
        unit: dto.unit,
        isCode: dto.isCode,
        sensitivityLevel: dto.sensitivityLevel as any,
        isExcluded: dto.isExcluded,
      },
    });
  }

  // ===========================================
  // Code Value Methods
  // ===========================================

  async getCodeValues(columnId: string) {
    return this.prisma.codeValue.findMany({
      where: { columnId },
      orderBy: { displayOrder: 'asc' }
    });
  }

  async createCodeValue(columnId: string, dto: CreateCodeValueDto) {
    return this.prisma.codeValue.create({
      data: {
        columnId,
        code: dto.code,
        value: dto.value,
        description: dto.description,
        displayOrder: dto.displayOrder
      }
    });
  }

  async updateCodeValue(id: string, dto: UpdateCodeValueDto) {
    return this.prisma.codeValue.update({
      where: { id },
      data: dto
    });
  }

  async deleteCodeValue(id: string) {
    return this.prisma.codeValue.delete({ where: { id } });
  }

  // ===========================================
  // Relationship Methods
  // ===========================================

  async getTableRelationships(tableId: string) {
    return this.prisma.tableRelationship.findMany({
      where: {
        OR: [
          { sourceTableId: tableId },
          { targetTableId: tableId }
        ]
      },
      include: {
        sourceTable: { select: { tableName: true } },
        targetTable: { select: { tableName: true } }
      }
    });
  }

  async createRelationship(sourceTableId: string, dto: CreateRelationshipDto) {
    return this.prisma.tableRelationship.create({
      data: {
        sourceTableId,
        targetTableId: dto.targetTableId,
        relationType: dto.relationType as any,
        description: dto.description
      }
    });
  }

  async deleteRelationship(id: string) {
    return this.prisma.tableRelationship.delete({ where: { id } });
  }

  // ===========================================
  // 인덱스 관련 메서드
  // ===========================================

  async getTableIndexes(tableId: string) {
    return this.prisma.indexMetadata.findMany({
      where: { tableId },
      orderBy: [
        { isPrimary: 'desc' },
        { isUnique: 'desc' },
        { indexName: 'asc' }
      ]
    });
  }

  /**
   * 단일 테이블의 AI 스키마 컨텍스트 조회
   * NL2SQL 시 LLM에 전달되는 형태와 동일한 포맷으로 반환
   */
  async getTableSchemaContext(tableId: string): Promise<{ context: string; metadata: any }> {
    const table = await this.prisma.tableMetadata.findUnique({
      where: { id: tableId },
      include: {
        columns: {
          include: {
            codeValueList: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' }
            }
          }
        },
        relationshipsFrom: { include: { targetTable: true } },
        relationshipsTo: { include: { sourceTable: true } }
      }
    });

    if (!table) {
      throw new Error('테이블을 찾을 수 없습니다.');
    }

    // Build context in the same format as getSchemaContext
    let context = '';

    // Display table/view type
    const objectType = table.tableType === 'VIEW' ? 'View' :
                       table.tableType === 'MATERIALIZED_VIEW' ? 'Materialized View' : 'Table';
    context += `${objectType}: ${table.schemaName}.${table.tableName}`;
    if (table.tableType === 'VIEW') context += ' [VIEW]';
    if (table.description) context += ` -- ${table.description}`;
    if (table.tags && table.tags.length > 0) context += ` (Tags: ${table.tags.join(', ')})`;
    context += '\n';

    // Include view definition for better SQL generation context
    if (table.tableType === 'VIEW' && table.viewDefinition) {
      const truncatedDef = table.viewDefinition.length > 500
        ? table.viewDefinition.substring(0, 500) + '...'
        : table.viewDefinition;
      context += `  View Definition: ${truncatedDef}\n`;
    }

    // Relations
    const relations = [
      ...table.relationshipsFrom.map(r => `Logical Relation: -> ${r.targetTable.tableName} (${r.description || r.relationType})`),
      ...table.relationshipsTo.map(r => `Logical Relation: <- ${r.sourceTable.tableName} (${r.description || r.relationType})`)
    ];
    if (relations.length > 0) {
      context += `Relationships:\n${relations.map(r => `  ${r}`).join('\n')}\n`;
    }

    // FK Relations from columns
    const fkColumns = table.columns.filter(c => c.isForeignKey && c.referencedTable);
    if (fkColumns.length > 0) {
      context += `Physical FK Relations:\n`;
      for (const col of fkColumns) {
        context += `  ${col.columnName} -> ${col.referencedTable}.${col.referencedColumn}\n`;
      }
    }

    context += 'Columns:\n';
    let includedCount = 0;
    let excludedCount = 0;

    for (const col of table.columns) {
      if (col.sensitivityLevel === 'STRICT' || col.isExcluded) {
        excludedCount++;
        continue; // Skip strict/excluded columns
      }
      includedCount++;

      context += `  - ${col.columnName}`;
      if (col.semanticName) context += ` ("${col.semanticName}")`;
      context += ` (${col.dataType})`;

      if (col.unit) context += ` [Unit: ${col.unit}]`;
      if (col.isPrimaryKey) context += ' [PK]';
      if (col.isForeignKey) context += ` [FK -> ${col.referencedTable}.${col.referencedColumn}]`;
      if (col.description) context += ` -- ${col.description}`;

      // Code Values
      if (col.isCode && col.codeValueList && col.codeValueList.length > 0) {
        const codes = col.codeValueList.map(cv => `${cv.code}=${cv.value}`).join(', ');
        context += `\n    Allowed Values: { ${codes} }`;
      }
      context += '\n';
    }

    // Metadata summary
    const metadata = {
      tableId: table.id,
      tableName: table.tableName,
      schemaName: table.schemaName,
      tableType: table.tableType,
      isExcluded: table.isExcluded,
      isSyncedWithAI: table.isSyncedWithAI,
      lastAiUpdate: table.lastAiUpdate,
      importanceLevel: table.importanceLevel,
      completenessScore: table.completenessScore,
      metadataStatus: table.metadataStatus,
      columnStats: {
        total: table.columns.length,
        included: includedCount,
        excluded: excludedCount,
        withSemanticName: table.columns.filter(c => c.semanticName).length,
        withDescription: table.columns.filter(c => c.description).length,
        withCodeValues: table.columns.filter(c => c.isCode && c.codeValueList && c.codeValueList.length > 0).length,
      },
      relationshipCount: relations.length,
      fkCount: fkColumns.length,
      contextLength: context.length,
      estimatedTokens: Math.ceil(context.length / 4), // Rough token estimate
    };

    return { context, metadata };
  }

  async updateTableDescription(tableId: string, description: string) {
    return this.prisma.tableMetadata.update({
      where: { id: tableId },
      data: { description },
    });
  }

  async updateColumnDescription(columnId: string, description: string) {
    return this.prisma.columnMetadata.update({
      where: { id: columnId },
      data: { description },
    });
  }

  async setTableExcluded(tableId: string, isExcluded: boolean) {
    return this.prisma.tableMetadata.update({
      where: { id: tableId },
      data: { isExcluded },
    });
  }

  async setColumnExcluded(columnId: string, isExcluded: boolean) {
    return this.prisma.columnMetadata.update({
      where: { id: columnId },
      data: { isExcluded },
    });
  }

  async deleteColumn(columnId: string) {
    return this.prisma.columnMetadata.delete({
      where: { id: columnId },
    });
  }

  async updateCodeValues(columnId: string, codeValues: Record<string, string>) {
    return this.prisma.columnMetadata.update({
      where: { id: columnId },
      data: { codeValues },
    });
  }

  async translateMetadata(dataSourceId: string, untranslatedOnly: boolean = false) {
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: false },
      include: {
        columns: true
      }
    });

    // LLM 설정 조회 (루프 밖에서 한 번만)
    const llmSettings = await this.getLLMSettings();

    let processedRequestCount = 0;
    let skippedCount = 0;
    const totalTables = tables.length;

    for (const table of tables) {
      // Skip tables with no columns
      if (!table.columns || table.columns.length === 0) {
        this.logger.warn(`Skipping table ${table.tableName}: no columns found`);
        continue;
      }

      // untranslatedOnly 모드: 이미 번역이 완료된 테이블은 스킵
      if (untranslatedOnly) {
        const hasTableDescription = !!table.description && table.description.trim().length > 0;
        const translatedColumns = table.columns.filter(col =>
          (col.semanticName && col.semanticName.trim().length > 0) ||
          (col.description && col.description.trim().length > 0)
        );
        const allColumnsTranslated = table.columns.length > 0 && translatedColumns.length === table.columns.length;

        // 테이블 설명과 모든 컬럼이 이미 번역되어 있으면 스킵
        if (hasTableDescription && allColumnsTranslated) {
          this.logger.log(`Skipping already translated table: ${table.tableName}`);
          skippedCount++;
          continue;
        }
      }

      try {
        // 배치 번역 사용
        const totalColumns = table.columns.length;
        const totalBatches = Math.ceil(totalColumns / llmSettings.batchSize);
        
        this.logger.log(`Translating table ${table.tableName}: ${totalColumns} columns in ${totalBatches} batches (batchSize=${llmSettings.batchSize})`);

        let tableDescription: string | undefined;
        const allTranslatedColumns: any[] = [];
        let failedBatches = 0;

        // 배치 단위로 번역 수행
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const startIdx = batchIndex * llmSettings.batchSize;
          const endIdx = Math.min(startIdx + llmSettings.batchSize, totalColumns);
          const batchColumns = table.columns.slice(startIdx, endIdx);
          
          const isFirstBatch = batchIndex === 0;

          try {
            const batchResult = await this.translateColumnBatch(
              table,
              batchColumns,
              batchIndex,
              totalBatches,
              isFirstBatch,
              { tokensPerColumn: llmSettings.tokensPerColumn, maxTokensTranslation: llmSettings.maxTokensTranslation }
            );

            if (isFirstBatch && batchResult.tableDescription) {
              tableDescription = batchResult.tableDescription;
            }

            allTranslatedColumns.push(...batchResult.columns);
          } catch (batchError) {
            this.logger.error(`Batch ${batchIndex + 1}/${totalBatches} failed for table ${table.tableName}: ${batchError.message}`);
            failedBatches++;
          }
        }

        // 모든 배치가 실패한 경우 건너뛰기
        if (failedBatches === totalBatches) {
          this.logger.error(`All batches failed for table ${table.tableName}`);
          continue;
        }

        // 결과 저장
        if (tableDescription) {
          await this.prisma.tableMetadata.update({
            where: { id: table.id },
            data: { description: tableDescription }
          });
        }

        // 컬럼 업데이트
        for (const colResult of allTranslatedColumns) {
          const column = table.columns.find(c => c.columnName === colResult.columnName);
          if (column) {
            await this.prisma.columnMetadata.update({
              where: { id: column.id },
              data: {
                semanticName: colResult.semanticName,
                description: colResult.description
              }
            });
          }
        }

        // 임베딩 생성 (제외된 컬럼은 임베딩에서 제외)
        const excludedColumnNames = new Set(
          table.columns.filter(c => c.isExcluded).map(c => c.columnName)
        );
        const result = {
          tableDescription,
          columns: allTranslatedColumns.filter(c => !excludedColumnNames.has(c.columnName))
        };
        await this.generateTableEmbedding(table, result);

        processedRequestCount++;
        this.logger.log(`Translated metadata for table ${table.tableName} (${processedRequestCount}/${totalTables}): ${allTranslatedColumns.length}/${totalColumns} columns`);
      } catch (error) {
        this.logger.error(`Failed to translate metadata for table ${table.tableName}: ${error.message}`);
      }
    }

    return { success: true, processed: processedRequestCount, skipped: skippedCount, total: totalTables };
  }


  // ===========================================
  // 단일 테이블 번역
  // ===========================================
  
  // LLM 설정 기본값
  private readonly LLM_SETTINGS_DEFAULTS = {
    llm_translation_batch_size: 20,
    llm_tokens_per_column: 100,
    llm_max_tokens_translation: 4000,
  };

  /**
   * LLM 관련 시스템 설정 조회
   */
  private async getLLMSettings(): Promise<{
    batchSize: number;
    tokensPerColumn: number;
    maxTokensTranslation: number;
  }> {
    try {
      const settings = await this.prisma.systemSettings.findMany({
        where: {
          key: {
            in: [
              'llm_translation_batch_size',
              'llm_tokens_per_column',
              'llm_max_tokens_translation',
            ],
          },
        },
      });

      const getValue = (key: string, defaultValue: number) => {
        const setting = settings.find((s) => s.key === key);
        if (setting?.value !== undefined) {
          const val = typeof setting.value === 'number' ? setting.value : Number(setting.value);
          return isNaN(val) ? defaultValue : val;
        }
        return defaultValue;
      };

      return {
        batchSize: getValue('llm_translation_batch_size', this.LLM_SETTINGS_DEFAULTS.llm_translation_batch_size),
        tokensPerColumn: getValue('llm_tokens_per_column', this.LLM_SETTINGS_DEFAULTS.llm_tokens_per_column),
        maxTokensTranslation: getValue('llm_max_tokens_translation', this.LLM_SETTINGS_DEFAULTS.llm_max_tokens_translation),
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch LLM settings, using defaults: ${error.message}`);
      return {
        batchSize: this.LLM_SETTINGS_DEFAULTS.llm_translation_batch_size,
        tokensPerColumn: this.LLM_SETTINGS_DEFAULTS.llm_tokens_per_column,
        maxTokensTranslation: this.LLM_SETTINGS_DEFAULTS.llm_max_tokens_translation,
      };
    }
  }

  /**
   * 잘린 JSON 응답 복구 시도
   * LLM이 max_tokens에 도달해서 응답이 잘린 경우 부분 데이터 추출
   */
  private repairTruncatedJson(content: string, columns: any[]): { columns: any[] } | null {
    const recoveredColumns: any[] = [];
    
    try {
      // columns 배열 시작점 찾기
      const columnsMatch = content.match(/"columns"\s*:\s*\[/);
      if (!columnsMatch) {
        this.logger.warn('repairTruncatedJson: columns array not found');
        return null;
      }
      
      const columnsStart = content.indexOf(columnsMatch[0]) + columnsMatch[0].length;
      let arrayContent = content.substring(columnsStart);
      
      // 개별 객체 추출 시도
      const objectPattern = /\{\s*"columnName"\s*:\s*"([^"]+)"\s*,\s*"semanticName"\s*:\s*"([^"]*)"\s*,\s*"description"\s*:\s*"([^"]*)"\s*\}/g;
      let match;
      
      while ((match = objectPattern.exec(arrayContent)) !== null) {
        recoveredColumns.push({
          columnName: match[1],
          semanticName: match[2],
          description: match[3]
        });
      }
      
      // 더 유연한 패턴으로 재시도 (필드 순서가 다를 수 있음)
      if (recoveredColumns.length === 0) {
        const flexiblePattern = /\{[^}]*"columnName"\s*:\s*"([^"]+)"[^}]*\}/g;
        arrayContent = content.substring(columnsStart);
        
        while ((match = flexiblePattern.exec(arrayContent)) !== null) {
          try {
            const objStr = match[0];
            // 불완전한 객체 정리
            let fixedObj = objStr
              .replace(/,\s*$/, '')  // 끝 쉼표 제거
              .replace(/,\s*"[^"]*"\s*:\s*$/, '');  // 불완전한 마지막 필드 제거
            
            if (!fixedObj.endsWith('}')) {
              fixedObj += '}';
            }
            
            const parsed = JSON.parse(fixedObj);
            if (parsed.columnName) {
              recoveredColumns.push({
                columnName: parsed.columnName,
                semanticName: parsed.semanticName || '',
                description: parsed.description || ''
              });
            }
          } catch {
            // 개별 객체 파싱 실패는 무시
          }
        }
      }
      
      if (recoveredColumns.length > 0) {
        this.logger.log(`repairTruncatedJson: Recovered ${recoveredColumns.length}/${columns.length} columns from truncated response`);
        return { columns: recoveredColumns };
      }
      
      this.logger.warn('repairTruncatedJson: Could not recover any columns');
      return null;
    } catch (error) {
      this.logger.error(`repairTruncatedJson failed: ${error.message}`);
      return null;
    }
  }

  /**
   * 컬럼 배치를 번역하는 헬퍼 메서드
   */
  private async translateColumnBatch(
    table: { tableName: string; schemaName: string },
    columns: any[],
    batchIndex: number,
    totalBatches: number,
    includeTableDescription: boolean,
    llmSettings: { tokensPerColumn: number; maxTokensTranslation: number }
  ): Promise<{ tableDescription?: string; columns: any[] }> {
    const columnDetails = columns.map(c => {
      let info = `${c.columnName} (${c.dataType}`;
      if (c.isNullable === false) info += ', NOT NULL';
      if (c.isPrimaryKey) info += ', PK';
      if (c.isForeignKey) info += `, FK -> ${c.referencedTable}.${c.referencedColumn}`;
      if (c.description) info += `, desc: ${c.description}`;
      info += ')';
      return info;
    }).join('\n  - ');

    let prompt: string;
    if (includeTableDescription) {
      prompt = `You are a database metadata expert. Analyze the following table schema and provide Korean semantic names (business terms) and descriptions.

Table Name: ${table.tableName}
Schema: ${table.schemaName}
Columns (batch ${batchIndex + 1}/${totalBatches}):
  - ${columnDetails}

Your task:
1. Provide a Korean description for the table explaining what it stores
2. For each column, provide:
   - semanticName: A Korean business term (e.g., "사용자 ID", "생성일시", "주문번호")
   - description: A brief Korean description of what the column contains

IMPORTANT: You MUST respond with ONLY a valid JSON object in this exact format, no other text:
{
  "tableDescription": "테이블 설명",
  "columns": [
    {
      "columnName": "${columns[0]?.columnName || 'column_name'}",
      "semanticName": "한글 의미명",
      "description": "한글 설명"
    }
  ]
}

Include ALL ${columns.length} columns in your response.`;
    } else {
      prompt = `You are a database metadata expert. Provide Korean semantic names and descriptions for the following columns.

Table Name: ${table.tableName}
Schema: ${table.schemaName}
Columns (batch ${batchIndex + 1}/${totalBatches}):
  - ${columnDetails}

For each column, provide:
- semanticName: A Korean business term (e.g., "사용자 ID", "생성일시", "주문번호")
- description: A brief Korean description of what the column contains

IMPORTANT: You MUST respond with ONLY a valid JSON object in this exact format, no other text:
{
  "columns": [
    {
      "columnName": "${columns[0]?.columnName || 'column_name'}",
      "semanticName": "한글 의미명",
      "description": "한글 설명"
    }
  ]
}

Include ALL ${columns.length} columns in your response.`;
    }

    // maxTokens를 컬럼 수에 맞게 동적으로 조정 (설정에서 가져온 값 사용)
    const estimatedTokens = Math.min(
      llmSettings.maxTokensTranslation,
      500 + columns.length * llmSettings.tokensPerColumn
    );

    const response = await this.llmService.generate({
      prompt,
      systemPrompt: 'You are a helpful data assistant. Output valid JSON only.',
      temperature: 0.1,
      maxTokens: estimatedTokens
    });

    let content = response.content;
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    content = content.replace(/```json\s*/gi, '');
    content = content.replace(/```\s*/gi, '');
    content = content.trim();

    let result: any = null;
    try {
      result = JSON.parse(content);
    } catch (firstError) {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start !== -1 && end !== -1 && start < end) {
        let jsonStr = content.substring(start, end + 1);
        jsonStr = jsonStr.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
          return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
        });
        try {
          result = JSON.parse(jsonStr);
        } catch {
          jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/'/g, '"');
          try {
            result = JSON.parse(jsonStr);
          } catch {
            // 잘린 JSON 배열 복구 시도
            result = this.repairTruncatedJson(jsonStr, columns);
          }
        }
      } else {
        // JSON 객체가 없는 경우 잘린 응답 복구 시도
        result = this.repairTruncatedJson(content, columns);
        if (!result) {
          throw new Error('No valid JSON object found in LLM response');
        }
      }
    }

    return {
      tableDescription: result.tableDescription,
      columns: result.columns || []
    };
  }

  async translateSingleTable(tableId: string) {
    const table = await this.prisma.tableMetadata.findUnique({
      where: { id: tableId },
      include: { columns: true }
    });

    if (!table) {
      throw new Error('테이블을 찾을 수 없습니다.');
    }

    if (!table.columns || table.columns.length === 0) {
      throw new Error('테이블에 컬럼이 없습니다.');
    }

    // LLM 설정 조회
    const llmSettings = await this.getLLMSettings();

    const totalColumns = table.columns.length;
    const totalBatches = Math.ceil(totalColumns / llmSettings.batchSize);
    
    this.logger.log(`Starting batch translation for table ${table.tableName}: ${totalColumns} columns in ${totalBatches} batches (batchSize=${llmSettings.batchSize})`);

    let tableDescription: string | undefined;
    const allTranslatedColumns: any[] = [];
    let failedBatches = 0;

    // 배치 단위로 번역 수행
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * llmSettings.batchSize;
      const endIdx = Math.min(startIdx + llmSettings.batchSize, totalColumns);
      const batchColumns = table.columns.slice(startIdx, endIdx);
      
      const isFirstBatch = batchIndex === 0;
      
      this.logger.log(`Translating batch ${batchIndex + 1}/${totalBatches} (${batchColumns.length} columns) for table ${table.tableName}`);

      // 재시도 로직 추가 (최대 2회)
      const maxRetries = 2;
      let attempts = 0;
      let success = false;

      while (attempts <= maxRetries && !success) {
        try {
          if (attempts > 0) {
            this.logger.log(`Retrying batch ${batchIndex + 1}/${totalBatches} (attempt ${attempts + 1}/${maxRetries + 1})`);
            // 재시도 전 짧은 지연
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const batchResult = await this.translateColumnBatch(
            table,
            batchColumns,
            batchIndex,
            totalBatches,
            isFirstBatch,
            { tokensPerColumn: llmSettings.tokensPerColumn, maxTokensTranslation: llmSettings.maxTokensTranslation }
          );

          if (isFirstBatch && batchResult.tableDescription) {
            tableDescription = batchResult.tableDescription;
          }

          allTranslatedColumns.push(...batchResult.columns);
          
          this.logger.log(`Batch ${batchIndex + 1}/${totalBatches} completed: ${batchResult.columns.length} columns translated`);
          success = true;
        } catch (error) {
          attempts++;
          if (attempts > maxRetries) {
            this.logger.error(`Batch ${batchIndex + 1}/${totalBatches} failed for table ${table.tableName} after ${attempts} attempts: ${error.message}`);
            failedBatches++;
          } else {
            this.logger.warn(`Batch ${batchIndex + 1}/${totalBatches} attempt ${attempts} failed: ${error.message}. Retrying...`);
          }
        }
      }
    }

    // 모든 배치가 실패한 경우
    if (failedBatches === totalBatches) {
      throw new Error(`번역 실패: 모든 ${totalBatches}개 배치가 실패했습니다.`);
    }

    // 결과 저장
    if (tableDescription) {
      await this.prisma.tableMetadata.update({
        where: { id: table.id },
        data: { description: tableDescription }
      });
    }

    // 컬럼 업데이트
    for (const colResult of allTranslatedColumns) {
      const column = table.columns.find(c => c.columnName === colResult.columnName);
      if (column) {
        await this.prisma.columnMetadata.update({
          where: { id: column.id },
          data: {
            semanticName: colResult.semanticName,
            description: colResult.description
          }
        });
      }
    }

    // 임베딩 생성 (제외된 컬럼은 임베딩에서 제외)
    const excludedColumnNames = new Set(
      table.columns.filter(c => c.isExcluded).map(c => c.columnName)
    );
    const result = {
      tableDescription,
      columns: allTranslatedColumns.filter(c => !excludedColumnNames.has(c.columnName))
    };
    await this.generateTableEmbedding(table, result);

    const successRate = ((totalBatches - failedBatches) / totalBatches * 100).toFixed(1);
    this.logger.log(`Translated table ${table.tableName}: ${allTranslatedColumns.length}/${totalColumns} columns (${successRate}% success rate)`);
    
    return { 
      success: true, 
      tableName: table.tableName,
      translatedColumns: allTranslatedColumns.length,
      totalColumns,
      failedBatches
    };
  }


  // ===========================================
  // 단일 테이블 AI 동기화 (임베딩 재생성)
  // ===========================================
  async syncSingleTableWithAI(tableId: string) {
    const table = await this.prisma.tableMetadata.findUnique({
      where: { id: tableId },
      include: {
        columns: {
          where: { isExcluded: false }, // 임베딩에서 제외된 컬럼 필터링
        },
      },
    });

    if (!table) {
      throw new Error('테이블을 찾을 수 없습니다.');
    }

    // 기존 메타데이터로 임베딩 재생성 (제외된 컬럼은 이미 필터링됨)
    const result = {
      tableDescription: table.description,
      columns: table.columns.map(c => ({
        columnName: c.columnName,
        semanticName: c.semanticName,
        description: c.description
      }))
    };

    await this.generateTableEmbedding(table, result);

    // Update sync status
    await this.prisma.tableMetadata.update({
      where: { id: table.id },
      data: {
        isSyncedWithAI: true,
        lastAiUpdate: new Date()
      }
    });

    this.logger.log(`Synced table ${table.tableName} with AI`);
    return { success: true, tableName: table.tableName };
  }

  // 테이블 임베딩 생성 헬퍼 메서드
  private async generateTableEmbedding(table: any, result: any) {
    try {
      const objectType = table.tableType === 'VIEW' ? 'View' :
                         table.tableType === 'MATERIALIZED_VIEW' ? 'Materialized View' : 'Table';
      let embeddingText = `${objectType}: ${table.tableName}`;

      if (result.tableDescription) embeddingText += `\nDescription: ${result.tableDescription}`;

      if (table.tableType === 'VIEW' && table.viewDefinition) {
        const truncatedDef = table.viewDefinition.length > 1000
          ? table.viewDefinition.substring(0, 1000) + '...'
          : table.viewDefinition;
        embeddingText += `\nView SQL: ${truncatedDef}`;
      }

      const colInfo = (result.columns || []).map((c: any) => {
        return `- ${c.columnName} (${c.semanticName || ''}): ${c.description || ''}`;
      }).join('\n');

      if (colInfo) embeddingText += `\nColumns:\n${colInfo}`;

      const embedding = await this.llmService.generateEmbedding(embeddingText);
      const vectorString = `[${embedding.join(',')}]`;

      await this.prisma.$executeRaw`
        INSERT INTO "SchemaEmbedding" ("id", "tableId", "content", "embedding", "updatedAt")
        VALUES (gen_random_uuid(), ${table.id}, ${embeddingText}, ${vectorString}::vector, NOW())
        ON CONFLICT ("tableId")
        DO UPDATE SET
          "content" = EXCLUDED."content",
          "embedding" = EXCLUDED."embedding",
          "updatedAt" = NOW();
      `;

      this.logger.log(`Generated embedding for table ${table.tableName}`);
    } catch (embedError) {
      this.logger.error(`Failed to generate embedding for table ${table.tableName}: ${embedError.message}`);
    }
  }

  // ===========================================
  // 제외 설정 일괄 반영 (임베딩 갱신)
  // ===========================================

  /**
   * 제외 설정이 변경된 테이블들의 임베딩을 일괄 갱신합니다.
   * - 제외된 테이블: SchemaEmbedding 삭제
   * - 제외된 컬럼이 있는 테이블: 해당 컬럼을 제외하고 임베딩 재생성
   */
  async syncExcludedItems(dataSourceId: string): Promise<{
    deletedTables: number;
    updatedTables: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let deletedTables = 0;
    let updatedTables = 0;

    // 1. 제외된 테이블의 SchemaEmbedding 삭제
    const excludedTables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: true },
      select: { id: true, tableName: true },
    });

    for (const table of excludedTables) {
      try {
        await this.prisma.$executeRaw`
          DELETE FROM "SchemaEmbedding" WHERE "tableId" = ${table.id}
        `;
        deletedTables++;
        this.logger.log(`Deleted embedding for excluded table: ${table.tableName}`);
      } catch (error) {
        errors.push(`${table.tableName}: 임베딩 삭제 실패 - ${error.message}`);
      }
    }

    // 2. 제외된 컬럼이 있는 테이블의 임베딩 재생성
    const tablesWithExcludedColumns = await this.prisma.tableMetadata.findMany({
      where: {
        dataSourceId,
        isExcluded: false,
        columns: {
          some: { isExcluded: true },
        },
      },
      include: {
        columns: true,
      },
    });

    for (const table of tablesWithExcludedColumns) {
      try {
        // 제외되지 않은 컬럼만 필터링
        const includedColumns = table.columns.filter(c => !c.isExcluded);

        const result = {
          tableDescription: table.description,
          columns: includedColumns.map(c => ({
            columnName: c.columnName,
            semanticName: c.semanticName,
            description: c.description,
          })),
        };

        await this.generateTableEmbedding(table, result);
        updatedTables++;
        this.logger.log(`Updated embedding for table with excluded columns: ${table.tableName}`);
      } catch (error) {
        errors.push(`${table.tableName}: 임베딩 갱신 실패 - ${error.message}`);
      }
    }

    this.logger.log(`Sync excluded items completed: ${deletedTables} deleted, ${updatedTables} updated, ${errors.length} errors`);

    return { deletedTables, updatedTables, errors };
  }

  // ===========================================
  // Excel Import/Export Methods
  // ===========================================

  async exportMetadataToExcel(dataSourceId: string) {
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId },
      include: {
        columns: {
          include: { codeValueList: { where: { isActive: true } } }
        }
      },
      orderBy: { tableName: 'asc' }
    });

    const rows: any[] = [];

    for (const table of tables) {
      for (const col of table.columns) {
        const codeValuesStr = col.codeValueList && col.codeValueList.length > 0
          ? col.codeValueList.map(cv => `${cv.code}=${cv.value}`).join(', ')
          : '';

        rows.push({
          '테이블명': table.tableName,
          '컬럼명': col.columnName,
          '논리적 이름': col.semanticName || '',
          '설명': col.description || '',
          '코드값': codeValuesStr,
          '데이터 타입': col.dataType,
          '민감도': col.sensitivityLevel,
          '제외 여부': col.isExcluded ? 'Y' : 'N'
        });
      }
    }

    return rows;
  }

  async importMetadataFromExcel(dataSourceId: string, rows: any[]) {
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Get all tables for this datasource
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId },
      include: { columns: true }
    });

    const tableMap = new Map(tables.map(t => [t.tableName.toLowerCase(), t]));

    for (const row of rows) {
      const tableName = row['테이블명'] || row['tableName'];
      const columnName = row['컬럼명'] || row['columnName'];
      
      if (!tableName || !columnName) {
        skipped++;
        continue;
      }

      const table = tableMap.get(tableName.toLowerCase());
      if (!table) {
        errors.push(`테이블 "${tableName}" 을 찾을 수 없습니다.`);
        skipped++;
        continue;
      }

      const column = table.columns.find(c => c.columnName.toLowerCase() === columnName.toLowerCase());
      if (!column) {
        errors.push(`테이블 "${tableName}"에서 컬럼 "${columnName}"을 찾을 수 없습니다.`);
        skipped++;
        continue;
      }

      // Update column metadata
      const semanticName = row['논리적 이름'] || row['semanticName'];
      const description = row['설명'] || row['description'];
      const codeValuesStr = row['코드값'] || row['codeValues'];

      await this.prisma.columnMetadata.update({
        where: { id: column.id },
        data: {
          semanticName: semanticName || column.semanticName,
          description: description || column.description,
        }
      });

      // Parse and create code values if provided
      if (codeValuesStr && codeValuesStr.trim()) {
        // Format: "A=활성, I=비활성"
        const pairs = codeValuesStr.split(',').map((p: string) => p.trim());
        for (const pair of pairs) {
          const [code, value] = pair.split('=').map((s: string) => s.trim());
          if (code && value) {
            await this.prisma.codeValue.upsert({
              where: { columnId_code: { columnId: column.id, code } },
              update: { value },
              create: { columnId: column.id, code, value }
            });
            // Also mark column as code column
            await this.prisma.columnMetadata.update({
              where: { id: column.id },
              data: { isCode: true }
            });
          }
        }
      }

      updated++;
    }

    return { updated, skipped, total: rows.length, errors };
  }

  getExcelTemplate() {
    return [
      {
        '테이블명': 'users',
        '컬럼명': 'status',
        '논리적 이름': '상태',
        '설명': '사용자 계정 상태',
        '코드값': 'A=활성, I=비활성, D=삭제'
      },
      {
        '테이블명': 'orders',
        '컬럼명': 'order_date',
        '논리적 이름': '주문일자',
        '설명': '주문이 생성된 날짜',
        '코드값': ''
      }
    ];
  }
}
