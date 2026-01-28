import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LLMService } from '../llm/llm.service';
import { createHash } from 'crypto';
import {
  CreateEmbeddingConfigDto,
  UpdateEmbeddingConfigDto,
  CreateEmbeddableItemDto,
  UpdateEmbeddableItemDto,
  ListEmbeddableItemsDto,
  BatchEmbedDto,
  SearchDto,
  SearchResult,
  SearchResponse,
  BatchEmbedResponse,
  SearchMethod,
  EmbeddableType,
} from './dto/embedding.dto';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  // BM25 파라미터
  private readonly BM25_K1 = 1.5;
  private readonly BM25_B = 0.75;

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
  ) {}

  // ===========================================
  // Embedding Config CRUD
  // ===========================================

  async createConfig(dto: CreateEmbeddingConfigDto) {
    return this.prisma.embeddingConfig.create({
      data: {
        name: dto.name,
        description: dto.description,
        topK: dto.topK ?? 10,
        searchMethod: dto.searchMethod ?? 'HYBRID',
        denseWeight: dto.denseWeight ?? 0.7,
        sparseWeight: dto.sparseWeight ?? 0.3,
        rrfK: dto.rrfK ?? 60,
        embeddingModel: dto.embeddingModel,
        dimensions: dto.dimensions ?? 768,
        dataSourceId: dto.dataSourceId,
      },
    });
  }

  async updateConfig(id: string, dto: UpdateEmbeddingConfigDto) {
    return this.prisma.embeddingConfig.update({
      where: { id },
      data: dto,
    });
  }

  async getConfig(id: string) {
    const config = await this.prisma.embeddingConfig.findUnique({
      where: { id },
    });
    if (!config) {
      throw new NotFoundException(`EmbeddingConfig not found: ${id}`);
    }
    return config;
  }

  async getConfigByName(name: string) {
    return this.prisma.embeddingConfig.findUnique({
      where: { name },
    });
  }

  async listConfigs(dataSourceId?: string) {
    return this.prisma.embeddingConfig.findMany({
      where: dataSourceId ? { dataSourceId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteConfig(id: string) {
    return this.prisma.embeddingConfig.delete({
      where: { id },
    });
  }

  // ===========================================
  // Embeddable Item CRUD
  // ===========================================

  async createItem(dto: CreateEmbeddableItemDto) {
    const tokens = this.tokenize(dto.content);
    const contentHash = this.hashContent(dto.content);

    return this.prisma.embeddableItem.create({
      data: {
        type: dto.type,
        sourceId: dto.sourceId,
        content: dto.content,
        contentHash,
        tokens,
        tokenCount: tokens.length,
        metadata: dto.metadata,
        dataSourceId: dto.dataSourceId,
      },
    });
  }

  async updateItem(id: string, dto: UpdateEmbeddableItemDto) {
    const updateData: any = { ...dto };

    if (dto.content) {
      updateData.tokens = this.tokenize(dto.content);
      updateData.tokenCount = updateData.tokens.length;
      updateData.contentHash = this.hashContent(dto.content);
      // 콘텐츠가 변경되면 임베딩 재생성 필요
      updateData.lastEmbeddedAt = null;
    }

    return this.prisma.embeddableItem.update({
      where: { id },
      data: updateData,
    });
  }

  async getItem(id: string) {
    const item = await this.prisma.embeddableItem.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException(`EmbeddableItem not found: ${id}`);
    }
    return item;
  }

  async listItems(query: ListEmbeddableItemsDto) {
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.dataSourceId) where.dataSourceId = query.dataSourceId;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, total] = await Promise.all([
      this.prisma.embeddableItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      }),
      this.prisma.embeddableItem.count({ where }),
    ]);

    return { items, total };
  }

  async deleteItem(id: string) {
    return this.prisma.embeddableItem.delete({
      where: { id },
    });
  }

  // ===========================================
  // Embedding Generation
  // ===========================================

  async generateEmbedding(itemId: string) {
    const item = await this.getItem(itemId);

    try {
      const embedding = await this.llmService.generateEmbedding(item.content);
      const vectorString = `[${embedding.join(',')}]`;

      await this.prisma.$executeRaw`
        UPDATE "EmbeddableItem"
        SET "embedding" = ${vectorString}::vector,
            "lastEmbeddedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE "id" = ${itemId}
      `;

      this.logger.log(`Generated embedding for item ${itemId}`);
      return { success: true, itemId };
    } catch (error) {
      this.logger.error(`Failed to generate embedding for item ${itemId}: ${error.message}`);
      throw error;
    }
  }

  async batchGenerateEmbeddings(dto: BatchEmbedDto): Promise<BatchEmbedResponse> {
    const where: any = { isActive: true };
    if (dto.dataSourceId) where.dataSourceId = dto.dataSourceId;
    if (dto.type) where.type = dto.type;
    if (!dto.forceRegenerate) {
      where.lastEmbeddedAt = null;
    }

    const items = await this.prisma.embeddableItem.findMany({
      where,
      select: { id: true, content: true },
    });

    let success = 0;
    let failed = 0;
    let skipped = 0;
    const errors: { id: string; error: string }[] = [];

    for (const item of items) {
      try {
        await this.generateEmbedding(item.id);
        success++;
      } catch (error) {
        failed++;
        errors.push({ id: item.id, error: error.message });
      }
    }

    this.logger.log(`Batch embedding complete: ${success} success, ${failed} failed, ${skipped} skipped`);
    return { success, failed, skipped, errors: errors.length > 0 ? errors : undefined };
  }

  // ===========================================
  // Search Methods
  // ===========================================

  async search(dto: SearchDto): Promise<SearchResponse> {
    const startTime = Date.now();

    // 설정 가져오기
    let config: any = null;
    if (dto.configId) {
      config = await this.getConfig(dto.configId);
    } else if (dto.dataSourceId) {
      config = await this.prisma.embeddingConfig.findFirst({
        where: { dataSourceId: dto.dataSourceId, isActive: true },
      });
    }

    const topK = dto.topK ?? config?.topK ?? 10;
    const searchMethod = dto.searchMethod ?? config?.searchMethod ?? SearchMethod.HYBRID;
    const denseWeight = config?.denseWeight ?? 0.7;
    const sparseWeight = config?.sparseWeight ?? 0.3;
    const rrfK = config?.rrfK ?? 60;

    let results: SearchResult[] = [];
    let denseTimeMs: number | undefined;
    let sparseTimeMs: number | undefined;

    if (searchMethod === SearchMethod.DENSE) {
      const denseStart = Date.now();
      results = await this.denseSearch(dto.query, dto.dataSourceId, topK, dto.type);
      denseTimeMs = Date.now() - denseStart;
    } else if (searchMethod === SearchMethod.SPARSE) {
      const sparseStart = Date.now();
      results = await this.sparseSearch(dto.query, dto.dataSourceId, topK, dto.type);
      sparseTimeMs = Date.now() - sparseStart;
    } else {
      // Hybrid search
      const denseStart = Date.now();
      const denseResults = await this.denseSearch(dto.query, dto.dataSourceId, topK * 2, dto.type);
      denseTimeMs = Date.now() - denseStart;

      const sparseStart = Date.now();
      const sparseResults = await this.sparseSearch(dto.query, dto.dataSourceId, topK * 2, dto.type);
      sparseTimeMs = Date.now() - sparseStart;

      results = this.reciprocalRankFusion(denseResults, sparseResults, rrfK, denseWeight, sparseWeight);
      results = results.slice(0, topK);
    }

    const totalTimeMs = Date.now() - startTime;

    // 검색 로그 저장
    await this.logSearch({
      query: dto.query,
      searchMethod,
      topK,
      resultCount: results.length,
      denseTimeMs,
      sparseTimeMs,
      totalTimeMs,
      dataSourceId: dto.dataSourceId,
    });

    return {
      results,
      totalCount: results.length,
      searchMethod,
      timing: {
        denseTimeMs,
        sparseTimeMs,
        totalTimeMs,
      },
    };
  }

  async denseSearch(
    query: string,
    dataSourceId?: string,
    topK: number = 10,
    type?: EmbeddableType,
  ): Promise<SearchResult[]> {
    try {
      const embedding = await this.llmService.generateEmbedding(query);
      const vectorStr = `[${embedding.join(',')}]`;

      // 동적 WHERE 조건 구성
      let whereClause = 'WHERE "isActive" = true AND "embedding" IS NOT NULL';
      if (dataSourceId) {
        whereClause += ` AND "dataSourceId" = '${dataSourceId}'`;
      }
      if (type) {
        whereClause += ` AND "type" = '${type}'`;
      }

      const results = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          "id", "content", "type", "sourceId", "metadata",
          (1 - ("embedding" <=> '${vectorStr}'::vector)) as similarity
        FROM "EmbeddableItem"
        ${whereClause}
        ORDER BY similarity DESC
        LIMIT ${topK}
      `);

      return results.map(row => ({
        id: row.id,
        content: row.content,
        type: row.type as EmbeddableType,
        sourceId: row.sourceId,
        denseScore: parseFloat(row.similarity?.toFixed(4) || '0'),
        metadata: row.metadata,
      }));
    } catch (error) {
      this.logger.error(`Dense search failed: ${error.message}`);
      return [];
    }
  }

  async sparseSearch(
    query: string,
    dataSourceId?: string,
    topK: number = 10,
    type?: EmbeddableType,
  ): Promise<SearchResult[]> {
    try {
      const queryTokens = this.tokenize(query);
      if (queryTokens.length === 0) return [];

      // 모든 활성 아이템 가져오기
      const where: any = { isActive: true };
      if (dataSourceId) where.dataSourceId = dataSourceId;
      if (type) where.type = type;

      const items = await this.prisma.embeddableItem.findMany({
        where,
        select: {
          id: true,
          content: true,
          type: true,
          sourceId: true,
          tokens: true,
          tokenCount: true,
          metadata: true,
        },
      });

      if (items.length === 0) return [];

      // 평균 문서 길이 계산
      const avgDocLength = items.reduce((sum, item) => sum + item.tokenCount, 0) / items.length;

      // 문서 빈도 계산
      const docFreqMap = new Map<string, number>();
      for (const item of items) {
        const uniqueTokens = new Set(item.tokens);
        for (const token of uniqueTokens) {
          docFreqMap.set(token, (docFreqMap.get(token) || 0) + 1);
        }
      }

      // BM25 점수 계산
      const scoredItems = items.map(item => ({
        ...item,
        sparseScore: this.calculateBM25Score(
          queryTokens,
          item.tokens,
          avgDocLength,
          docFreqMap,
          items.length,
        ),
      }));

      // 점수별 정렬
      scoredItems.sort((a, b) => b.sparseScore - a.sparseScore);

      return scoredItems.slice(0, topK).map(item => ({
        id: item.id,
        content: item.content,
        type: item.type as EmbeddableType,
        sourceId: item.sourceId ?? undefined,
        sparseScore: parseFloat(item.sparseScore.toFixed(4)),
        metadata: item.metadata as Record<string, any> | undefined,
      }));
    } catch (error) {
      this.logger.error(`Sparse search failed: ${error.message}`);
      return [];
    }
  }

  // ===========================================
  // BM25 Implementation
  // ===========================================

  calculateBM25Score(
    queryTokens: string[],
    documentTokens: string[],
    avgDocLength: number,
    docFreqMap: Map<string, number>,
    totalDocs: number,
  ): number {
    let score = 0;
    const docLength = documentTokens.length;

    for (const term of queryTokens) {
      const termFreq = documentTokens.filter(t => t === term).length;
      if (termFreq === 0) continue;

      const docFreq = docFreqMap.get(term) || 0;

      // IDF 계산
      const idf = Math.log((totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);

      // TF 계산 (BM25 방식)
      const tf =
        (termFreq * (this.BM25_K1 + 1)) /
        (termFreq + this.BM25_K1 * (1 - this.BM25_B + this.BM25_B * (docLength / avgDocLength)));

      score += idf * tf;
    }

    return score;
  }

  // ===========================================
  // Reciprocal Rank Fusion (RRF)
  // ===========================================

  reciprocalRankFusion(
    denseResults: SearchResult[],
    sparseResults: SearchResult[],
    k: number = 60,
    denseWeight: number = 0.7,
    sparseWeight: number = 0.3,
  ): SearchResult[] {
    const scoreMap = new Map<string, { item: SearchResult; score: number }>();

    // Dense 결과 처리
    denseResults.forEach((result, rank) => {
      const rrfScore = denseWeight * (1 / (k + rank + 1));
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.score += rrfScore;
        // denseScore 유지
        if (result.denseScore !== undefined) {
          existing.item.denseScore = result.denseScore;
        }
      } else {
        scoreMap.set(result.id, { item: { ...result }, score: rrfScore });
      }
    });

    // Sparse 결과 처리
    sparseResults.forEach((result, rank) => {
      const rrfScore = sparseWeight * (1 / (k + rank + 1));
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.score += rrfScore;
        // sparseScore 추가
        if (result.sparseScore !== undefined) {
          existing.item.sparseScore = result.sparseScore;
        }
      } else {
        scoreMap.set(result.id, { item: { ...result }, score: rrfScore });
      }
    });

    // 점수별 정렬 후 반환
    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(entry => ({
        ...entry.item,
        hybridScore: parseFloat(entry.score.toFixed(6)),
      }));
  }

  // ===========================================
  // Utility Methods
  // ===========================================

  tokenize(text: string): string[] {
    // 기본 토큰화: 소문자 변환, 특수문자 제거, 공백으로 분리
    return text
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1); // 1글자 토큰 제거
  }

  private hashContent(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  private async logSearch(data: {
    query: string;
    searchMethod: SearchMethod;
    topK: number;
    resultCount: number;
    denseTimeMs?: number;
    sparseTimeMs?: number;
    totalTimeMs: number;
    dataSourceId?: string;
  }) {
    try {
      await this.prisma.searchLog.create({
        data: {
          query: data.query,
          searchMethod: data.searchMethod,
          topK: data.topK,
          resultCount: data.resultCount,
          denseTimeMs: data.denseTimeMs,
          sparseTimeMs: data.sparseTimeMs,
          totalTimeMs: data.totalTimeMs,
          dataSourceId: data.dataSourceId,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to log search: ${error.message}`);
    }
  }

  // ===========================================
  // Schema Context Search (기존 메서드와의 통합)
  // ===========================================

  async searchSchemaContext(
    dataSourceId: string,
    question: string,
    limit: number = 20,
    searchMethod: SearchMethod = SearchMethod.HYBRID,
  ): Promise<string> {
    // 기존 SchemaEmbedding 테이블 사용하는 검색
    const startTime = Date.now();

    try {
      if (searchMethod === SearchMethod.HYBRID) {
        return await this.hybridSchemaSearch(dataSourceId, question, limit);
      } else if (searchMethod === SearchMethod.SPARSE) {
        return await this.sparseSchemaSearch(dataSourceId, question, limit);
      } else {
        return await this.denseSchemaSearch(dataSourceId, question, limit);
      }
    } catch (error) {
      this.logger.error(`Schema context search failed: ${error.message}`);
      return '';
    }
  }

  private async denseSchemaSearch(
    dataSourceId: string,
    question: string,
    limit: number,
  ): Promise<string> {
    const embedding = await this.llmService.generateEmbedding(question);
    const vectorStr = `[${embedding.join(',')}]`;

    const results = await this.prisma.$queryRaw<any[]>`
      SELECT t."tableName", s."content", 
             (1 - (s."embedding" <=> ${vectorStr}::vector)) as similarity
      FROM "SchemaEmbedding" s
      JOIN "TableMetadata" t ON s."tableId" = t."id"
      WHERE t."dataSourceId" = ${dataSourceId} AND t."isExcluded" = false
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    return results.map(row => row.content).join('\n\n');
  }

  private async sparseSchemaSearch(
    dataSourceId: string,
    question: string,
    limit: number,
  ): Promise<string> {
    const queryTokens = this.tokenize(question);

    // SchemaEmbedding의 content를 가져와서 BM25 적용
    const schemas = await this.prisma.schemaEmbedding.findMany({
      where: {
        table: {
          dataSourceId,
          isExcluded: false,
        },
      },
      include: {
        table: {
          select: { tableName: true },
        },
      },
    });

    const avgDocLength = schemas.reduce((sum, s) => sum + s.content.length, 0) / schemas.length;

    // 문서 빈도 계산
    const docFreqMap = new Map<string, number>();
    const tokenizedSchemas = schemas.map(s => ({
      ...s,
      tokens: this.tokenize(s.content),
    }));

    for (const schema of tokenizedSchemas) {
      const uniqueTokens = new Set(schema.tokens);
      for (const token of uniqueTokens) {
        docFreqMap.set(token, (docFreqMap.get(token) || 0) + 1);
      }
    }

    // BM25 점수 계산
    const scoredSchemas = tokenizedSchemas.map(schema => ({
      ...schema,
      score: this.calculateBM25Score(
        queryTokens,
        schema.tokens,
        avgDocLength / 10, // 문자 길이를 토큰 길이로 대략 변환
        docFreqMap,
        schemas.length,
      ),
    }));

    scoredSchemas.sort((a, b) => b.score - a.score);

    return scoredSchemas
      .slice(0, limit)
      .map(s => s.content)
      .join('\n\n');
  }

  private async hybridSchemaSearch(
    dataSourceId: string,
    question: string,
    limit: number,
  ): Promise<string> {
    // Dense 검색
    const embedding = await this.llmService.generateEmbedding(question);
    const vectorStr = `[${embedding.join(',')}]`;

    const denseResults = await this.prisma.$queryRaw<any[]>`
      SELECT s."id", t."tableName", s."content", 
             (1 - (s."embedding" <=> ${vectorStr}::vector)) as similarity
      FROM "SchemaEmbedding" s
      JOIN "TableMetadata" t ON s."tableId" = t."id"
      WHERE t."dataSourceId" = ${dataSourceId} AND t."isExcluded" = false
      ORDER BY similarity DESC
      LIMIT ${limit * 2}
    `;

    // Sparse (BM25) 검색
    const queryTokens = this.tokenize(question);
    const schemas = await this.prisma.schemaEmbedding.findMany({
      where: {
        table: {
          dataSourceId,
          isExcluded: false,
        },
      },
      include: {
        table: {
          select: { tableName: true },
        },
      },
    });

    const avgDocLength = schemas.length > 0 
      ? schemas.reduce((sum, s) => sum + s.content.length, 0) / schemas.length / 10
      : 100;

    const docFreqMap = new Map<string, number>();
    const tokenizedSchemas = schemas.map(s => ({
      ...s,
      tokens: this.tokenize(s.content),
    }));

    for (const schema of tokenizedSchemas) {
      const uniqueTokens = new Set(schema.tokens);
      for (const token of uniqueTokens) {
        docFreqMap.set(token, (docFreqMap.get(token) || 0) + 1);
      }
    }

    const sparseResults = tokenizedSchemas
      .map(schema => ({
        id: schema.id,
        tableName: schema.table.tableName,
        content: schema.content,
        score: this.calculateBM25Score(
          queryTokens,
          schema.tokens,
          avgDocLength,
          docFreqMap,
          schemas.length,
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit * 2);

    // RRF로 결합
    const scoreMap = new Map<string, { content: string; score: number }>();

    denseResults.forEach((result, rank) => {
      const rrfScore = 0.7 * (1 / (60 + rank + 1));
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(result.id, { content: result.content, score: rrfScore });
      }
    });

    sparseResults.forEach((result, rank) => {
      const rrfScore = 0.3 * (1 / (60 + rank + 1));
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(result.id, { content: result.content, score: rrfScore });
      }
    });

    const hybridResults = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return hybridResults.map(r => r.content).join('\n\n');
  }

  // ===========================================
  // Metadata Auto-Sync (자동 동기화)
  // ===========================================

  /**
   * 테이블 메타데이터 변경 시 EmbeddableItem 자동 생성/업데이트
   */
  async syncTableEmbedding(tableId: string): Promise<void> {
    try {
      const table = await this.prisma.tableMetadata.findUnique({
        where: { id: tableId },
        include: {
          columns: {
            where: { isExcluded: false },
          },
        },
      });

      if (!table || table.isExcluded) {
        // 테이블이 없거나 제외된 경우 기존 항목 삭제
        await this.prisma.embeddableItem.deleteMany({
          where: { sourceId: tableId, type: 'TABLE' },
        });
        return;
      }

      // 임베딩 텍스트 생성
      const objectType = table.tableType === 'VIEW' ? 'View' : 
                        table.tableType === 'MATERIALIZED_VIEW' ? 'Materialized View' : 'Table';
      
      let content = `${objectType}: ${table.tableName}`;
      if (table.description) content += `\nDescription: ${table.description}`;
      
      const colInfo = table.columns.map(col => {
        let colLine = `- ${col.columnName} (${col.dataType})`;
        if (col.semanticName) colLine += ` [${col.semanticName}]`;
        if (col.description) colLine += `: ${col.description}`;
        return colLine;
      }).join('\n');
      
      if (colInfo) content += `\nColumns:\n${colInfo}`;

      const tokens = this.tokenize(content);
      const contentHash = this.hashContent(content);

      // Upsert EmbeddableItem
      const existingItem = await this.prisma.embeddableItem.findFirst({
        where: { sourceId: tableId, type: 'TABLE' },
      });

      if (existingItem) {
        // 콘텐츠가 변경된 경우에만 업데이트
        if (existingItem.contentHash !== contentHash) {
          await this.prisma.embeddableItem.update({
            where: { id: existingItem.id },
            data: {
              content,
              contentHash,
              tokens,
              tokenCount: tokens.length,
              lastEmbeddedAt: null, // 재임베딩 필요
              metadata: {
                tableName: table.tableName,
                schemaName: table.schemaName,
                tableType: table.tableType,
              },
            },
          });
          this.logger.log(`Updated EmbeddableItem for table ${table.tableName}`);
        }
      } else {
        await this.prisma.embeddableItem.create({
          data: {
            type: 'TABLE',
            sourceId: tableId,
            content,
            contentHash,
            tokens,
            tokenCount: tokens.length,
            dataSourceId: table.dataSourceId,
            metadata: {
              tableName: table.tableName,
              schemaName: table.schemaName,
              tableType: table.tableType,
            },
          },
        });
        this.logger.log(`Created EmbeddableItem for table ${table.tableName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to sync table embedding for ${tableId}: ${error.message}`);
    }
  }

  /**
   * 데이터소스의 모든 테이블에 대해 EmbeddableItem 동기화
   */
  async syncDataSourceEmbeddings(dataSourceId: string): Promise<{ synced: number; errors: number }> {
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: false },
      select: { id: true },
    });

    let synced = 0;
    let errors = 0;

    for (const table of tables) {
      try {
        await this.syncTableEmbedding(table.id);
        synced++;
      } catch (error) {
        errors++;
        this.logger.error(`Failed to sync embedding for table ${table.id}: ${error.message}`);
      }
    }

    this.logger.log(`DataSource ${dataSourceId} embedding sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  }

  /**
   * 샘플 쿼리에 대한 EmbeddableItem 동기화
   */
  async syncSampleQueryEmbedding(sampleQueryId: string): Promise<void> {
    try {
      const sampleQuery = await this.prisma.sampleQuery.findUnique({
        where: { id: sampleQueryId },
      });

      if (!sampleQuery) {
        await this.prisma.embeddableItem.deleteMany({
          where: { sourceId: sampleQueryId, type: 'SAMPLE_QUERY' },
        });
        return;
      }

      const content = `Question: ${sampleQuery.naturalQuery}\nSQL: ${sampleQuery.sqlQuery}${sampleQuery.description ? `\nDescription: ${sampleQuery.description}` : ''}`;
      const tokens = this.tokenize(content);
      const contentHash = this.hashContent(content);

      const existingItem = await this.prisma.embeddableItem.findFirst({
        where: { sourceId: sampleQueryId, type: 'SAMPLE_QUERY' },
      });

      if (existingItem) {
        if (existingItem.contentHash !== contentHash) {
          await this.prisma.embeddableItem.update({
            where: { id: existingItem.id },
            data: {
              content,
              contentHash,
              tokens,
              tokenCount: tokens.length,
              lastEmbeddedAt: null,
              metadata: { tags: sampleQuery.tags },
            },
          });
        }
      } else {
        await this.prisma.embeddableItem.create({
          data: {
            type: 'SAMPLE_QUERY',
            sourceId: sampleQueryId,
            content,
            contentHash,
            tokens,
            tokenCount: tokens.length,
            dataSourceId: null, // Global SampleQuery, or sampleQuery.dataSourceId if it exists
            metadata: { tags: sampleQuery.tags },
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to sync sample query embedding for ${sampleQueryId}: ${error.message}`);
    }
  }

  /**
   * 모든 데이터소스 및 샘플 쿼리에 대해 EmbeddableItem 동기화
   */
  async syncAllEmbeddings(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    // 1. 모든 데이터소스 동기화
    const dataSources = await this.prisma.dataSource.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const ds of dataSources) {
      const result = await this.syncDataSourceEmbeddings(ds.id);
      synced += result.synced;
      errors += result.errors;
    }

    // 2. 모든 샘플 쿼리 동기화
    const sampleQueries = await this.prisma.sampleQuery.findMany({
      select: { id: true },
    });

    for (const sq of sampleQueries) {
      try {
        await this.syncSampleQueryEmbedding(sq.id);
        synced++;
      } catch (error) {
        errors++;
      }
    }

    this.logger.log(`Total embedding sync complete: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  }
}

