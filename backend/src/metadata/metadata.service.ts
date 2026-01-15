import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourcesService } from '../datasources/datasources.service';
import { Client as PgClient } from 'pg';
import * as mysql from 'mysql2/promise';
import oracledb from 'oracledb';
import { LLMService } from '../llm/llm.service';
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

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    private prisma: PrismaService,
    private dataSourcesService: DataSourcesService,
    private llmService: LLMService,
  ) {}

  async syncMetadata(dataSourceId: string): Promise<{ tables: number; columns: number }> {
    const dataSource = await this.dataSourcesService.findOne(dataSourceId);
    const { client, type } = await this.dataSourcesService.getConnection(dataSourceId);

    let tables: TableInfo[] = [];
    let allColumns: Map<string, ColumnInfo[]> = new Map();

    if (type === 'postgresql' || dataSource.type === 'postgresql') {
      const result = await this.syncPostgreSQLMetadata(client as PgClient, dataSource.schema || 'public');
      tables = result.tables;
      allColumns = result.columns;
    } else if (type === 'mysql' || dataSource.type === 'mysql') {
      const result = await this.syncMySQLMetadata(client as mysql.Connection, dataSource.database);
      tables = result.tables;
      allColumns = result.columns;
    } else if (type === 'oracle' || dataSource.type === 'oracle') {
      const result = await this.syncOracleMetadata(client as oracledb.Connection, dataSource.schema || dataSource.username?.toUpperCase());
      tables = result.tables;
      allColumns = result.columns;
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
    }

    const totalColumns = Array.from(allColumns.values()).reduce((sum, cols) => sum + cols.length, 0);
    return { tables: tables.length, columns: totalColumns };
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

    return { tables, columns };
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

    return { tables, columns };
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

    return { tables, columns };
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
        const query = `SELECT * FROM "${schemaName}"."${tableName}" WHERE ROWNUM <= :limit`;
        const result = await (client as oracledb.Connection).execute(
          query,
          { limit },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        return result.rows || [];
      }
    } catch (error) {
      this.logger.error(`Preview failed for ${tableName}: ${error.message}`);
      throw new Error('Failed to preview table data');
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

  async getSchemaContext(dataSourceId: string): Promise<string> {
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: false },
      include: { 
        columns: {
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
        if (col.sensitivityLevel === SensitivityLevel.STRICT) continue; // Skip strict columns

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

  async searchSchemaContext(dataSourceId: string, question: string, limit: number = 20): Promise<string> {
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
      let viewContext = '';
      if (matchedViews.length > 0) {
        this.logger.log(`[View Boost] Found ${matchedViews.length} relevant views for question: "${question.substring(0, 50)}..."`);
        viewContext = '=== 추천 뷰 테이블 (질문과 유사) ===\n\n';
        
        for (const view of matchedViews) {
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

      // 4. Perform Vector Search for remaining tables
      const results = await this.prisma.$queryRaw<any[]>`
        SELECT t."tableName", s."content", 
               (s."embedding" <=> ${vectorStr}::vector) as distance
        FROM "SchemaEmbedding" s
        JOIN "TableMetadata" t ON s."tableId" = t."id"
        WHERE t."dataSourceId" = ${dataSourceId}
        ORDER BY distance ASC
        LIMIT ${limit}
      `;

      if (!results || results.length === 0) {
        if (viewContext) {
          // Return only view context if no vector results
          return viewContext;
        }
        this.logger.warn(`No vector search results found for DataSource ${dataSourceId}. Falling back to full schema.`);
        return this.getSchemaContext(dataSourceId);
      }

      // 5. Construct Context from results (with view context prepended)
      let context = viewContext;
      if (!viewContext) {
        context = 'Selected Schema (based on relevance):\n\n';
      }
      
      for (const row of results) {
        // Skip if this table was already included as a matched view
        const isAlreadyIncluded = matchedViews.some(v => v.tableName === row.tableName);
        if (!isAlreadyIncluded) {
          context += `${row.content}\n\n`;
        }
      }
      
      return context;

    } catch (error) {
       this.logger.error(`Vector search failed: ${error.message}. Falling back to full schema.`);
       return this.getSchemaContext(dataSourceId);
    }
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
      include: { columns: true },
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

  async translateMetadata(dataSourceId: string) {
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: false },
      include: { 
        columns: true 
      }
    });

    let processedRequestCount = 0;
    const totalTables = tables.length;

    for (const table of tables) {
      // Skip tables with no columns
      if (!table.columns || table.columns.length === 0) {
        this.logger.warn(`Skipping table ${table.tableName}: no columns found`);
        continue;
      }

      // Build detailed column info including data types
      const columnDetails = table.columns.map(c => {
        let info = `${c.columnName} (${c.dataType}`;
        if (c.isNullable === false) info += ', NOT NULL';
        if (c.isPrimaryKey) info += ', PK';
        if (c.isForeignKey) info += `, FK -> ${c.referencedTable}.${c.referencedColumn}`;
        if (c.description) info += `, desc: ${c.description}`;
        info += ')';
        return info;
      }).join('\n  - ');

      // Logic to translate table and columns
      const prompt = `You are a database metadata expert. Analyze the following table schema and provide Korean semantic names (business terms) and descriptions.

Table Name: ${table.tableName}
Schema: ${table.schemaName}
Columns:
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
      "columnName": "${table.columns[0]?.columnName || 'column_name'}",
      "semanticName": "한글 의미명",
      "description": "한글 설명"
    }
  ]
}

Include ALL ${table.columns.length} columns in your response.`;

      try {
        const response = await this.llmService.generate({
          prompt,
          systemPrompt: 'You are a helpful data assistant. Output valid JSON only.',
          temperature: 0.1,
          maxTokens: 2000
        });

        // Clean up LLM response - handle various formats
        let content = response.content;
        
        // Log raw response for debugging
        this.logger.debug(`Raw LLM response for ${table.tableName}: ${content.substring(0, 500)}...`);
        
        // Remove qwen3 thinking blocks (if any)
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
        
        // Remove markdown code blocks (various formats)
        content = content.replace(/```json\s*/gi, '');
        content = content.replace(/```\s*/gi, '');
        content = content.trim();
        
        // Try multiple approaches to extract JSON
        let result: any = null;
        
        // Approach 1: Direct parse
        try {
          result = JSON.parse(content);
        } catch {
          // Approach 2: Find JSON object boundaries
          const start = content.indexOf('{');
          const end = content.lastIndexOf('}');
          
          if (start !== -1 && end !== -1 && start < end) {
            let jsonStr = content.substring(start, end + 1);
            
            // Fix control characters ONLY inside string values (between quotes)
            jsonStr = jsonStr.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
              return match
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
            });
            
            try {
              result = JSON.parse(jsonStr);
            } catch (parseErr) {
              // Approach 3: Try to fix common JSON issues
              jsonStr = jsonStr
                .replace(/,\s*}/g, '}')  // trailing comma
                .replace(/,\s*]/g, ']')  // trailing comma in array
                .replace(/'/g, '"');     // single quotes to double
              
              try {
                result = JSON.parse(jsonStr);
              } catch {
                this.logger.warn(`JSON parse failed for ${table.tableName}, content preview: ${jsonStr.substring(0, 200)}`);
                throw new Error('Failed to parse JSON from LLM response');
              }
            }
          } else {
            this.logger.warn(`No JSON object found in response for ${table.tableName}`);
            throw new Error('No valid JSON object found in LLM response');
          }
        }

        // Update Table
        if (result.tableDescription) {
          await this.prisma.tableMetadata.update({
            where: { id: table.id },
            data: { description: result.tableDescription }
          });
        }

        // Update Columns
        if (result.columns && Array.isArray(result.columns)) {
          for (const colResult of result.columns) {
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
            }


        // ===========================================
        // Generate & Store Embedding (Vector RAG)
        // ===========================================
        try {
          // 1. Construct rich text representation
          // Include table type (VIEW/TABLE) for better context
          const objectType = table.tableType === 'VIEW' ? 'View' : 
                             table.tableType === 'MATERIALIZED_VIEW' ? 'Materialized View' : 'Table';
          let embeddingText = `${objectType}: ${table.tableName}`;
          
          if (result.tableDescription) embeddingText += `\nDescription: ${result.tableDescription}`;
          
          // For VIEWs, include the SQL definition for better RAG matching
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

          // 2. Generate Embedding
          // Note: Ideally use a specific embedding model. If main model fails (e.g. chat only), catch error.
          const embedding = await this.llmService.generateEmbedding(embeddingText);

          // 3. Store in DB (using raw query for vector type)
          // Ensure embedding is a string formatted as vector for PostgreSQL '[1,2,3]'
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
          
          this.logger.log(`Generated and stored embedding for table ${table.tableName}`);
        } catch (embedError) {
          this.logger.error(`Failed to generate embedding for table ${table.tableName}: ${embedError.message}`);
          // Continue even if embedding fails, as translation is main goal here
        }
        processedRequestCount++;
        this.logger.log(`Translated metadata for table ${table.tableName} (${processedRequestCount}/${totalTables})`);
      } catch (error) {
        this.logger.error(`Failed to translate metadata for table ${table.tableName}: ${error.message}`);
      }
    }

    return { success: true, processed: processedRequestCount, total: totalTables };
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
