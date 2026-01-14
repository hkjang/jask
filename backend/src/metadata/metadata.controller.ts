import { Controller, Post, Put, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MetadataService } from './metadata.service';
import { MetadataAiService } from './metadata-ai.service';
import { UpdateDescriptionDto, UpdateCodeValuesDto } from './dto/metadata.dto';

@ApiTags('Metadata')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('metadata')
export class MetadataController {
  constructor(
    private readonly metadataService: MetadataService,
    private readonly metadataAiService: MetadataAiService
  ) {}

  @Post('tables/:tableId/ai-draft')
  @ApiOperation({ summary: 'AI 메타데이터 초안 생성' })
  async generateTableDraft(@Param('tableId') tableId: string) {
    // 1. Get Table Context
    const table = await this.metadataService.getTableWithColumns(tableId); // Need to expose/create this method
    if (!table) throw new Error('Table not found');

    // 2. Generate Drafts
    const description = await this.metadataAiService.generateTableDescription(table.tableName, table.columns);
    const colMetadata = await this.metadataAiService.generateColumnMetadata(table.tableName, table.columns);

    return {
      description,
      columns: colMetadata
    };
  }

  @Post('tables/:tableId/validate')
  @ApiOperation({ summary: '메타데이터 품질 검증' })
  async validateTable(@Param('tableId') tableId: string) {
    return this.metadataService.calculateAndSaveQualityScore(tableId);
  }

  @Post('sync/:dataSourceId')
  @ApiOperation({ summary: '메타데이터 동기화' })
  async syncMetadata(@Param('dataSourceId') dataSourceId: string) {
    return this.metadataService.syncMetadata(dataSourceId);
  }

  @Post('translate/:dataSourceId')
  @ApiOperation({ summary: '메타데이터 AI 번역 (한글화)' })
  async translateMetadata(@Param('dataSourceId') dataSourceId: string) {
    return this.metadataService.translateMetadata(dataSourceId);
  }

  @Get('schema/:dataSourceId')
  @ApiOperation({ summary: '스키마 컨텍스트 조회' })
  async getSchemaContext(@Param('dataSourceId') dataSourceId: string) {
    const context = await this.metadataService.getSchemaContext(dataSourceId);
    return { context };
  }

  @Get('tables/:dataSourceId')
  @ApiOperation({ summary: '테이블 목록 조회' })
  async getTables(@Param('dataSourceId') dataSourceId: string) {
    return this.metadataService.getTables(dataSourceId);
  }

  @Get('tables/:tableId/preview')
  @ApiOperation({ summary: '테이블 데이터 미리보기' })
  async previewTableData(@Param('tableId') tableId: string) {
    return this.metadataService.previewTableData(tableId);
  }

  @Put('table/:tableId')
  @ApiOperation({ summary: '테이블 메타데이터 수정 (확장)' })
  async updateTableExtendedMetadata(
    @Param('tableId') tableId: string,
    @Body() dto: UpdateDescriptionDto & any, // Using intersection for backward compat or just new dto
  ) {
    // Note: To support both legacy and new DTOs in a clean way, ideally we change the Body type. 
    // But let's assume the frontend will send the new DTO structure.
    return this.metadataService.updateTableExtendedMetadata(tableId, dto);
  }

  @Put('column/:columnId')
  @ApiOperation({ summary: '컬럼 메타데이터 수정 (확장)' })
  async updateColumnExtendedMetadata(
    @Param('columnId') columnId: string,
    @Body() dto: any,
  ) {
    return this.metadataService.updateColumnExtendedMetadata(columnId, dto);
  }

  // --- Code Values ---

  @Get('column/:columnId/codes')
  @ApiOperation({ summary: '컬럼 코드값 목록 조회' })
  async getCodeValues(@Param('columnId') columnId: string) {
    return this.metadataService.getCodeValues(columnId);
  }

  @Post('column/:columnId/codes')
  @ApiOperation({ summary: '코드값 추가' })
  async createCodeValue(
    @Param('columnId') columnId: string,
    @Body() dto: any,
  ) {
    return this.metadataService.createCodeValue(columnId, dto);
  }

  @Put('codes/:codeValueId')
  @ApiOperation({ summary: '코드값 수정' })
  async updateCodeValue(
    @Param('codeValueId') codeValueId: string,
    @Body() dto: any,
  ) {
    return this.metadataService.updateCodeValue(codeValueId, dto);
  }

  @Post('codes/:codeValueId/delete') // Using Post for delete to avoid issues if needed, or Delete method
  @ApiOperation({ summary: '코드값 삭제' })
  async deleteCodeValue(@Param('codeValueId') codeValueId: string) {
    return this.metadataService.deleteCodeValue(codeValueId);
  }

  // --- Relationships ---

  @Get('table/:tableId/relationships')
  @ApiOperation({ summary: '테이블 관계 조회' })
  async getTableRelationships(@Param('tableId') tableId: string) {
    return this.metadataService.getTableRelationships(tableId);
  }

  @Post('table/:tableId/relationships')
  @ApiOperation({ summary: '관계 생성' })
  async createRelationship(
    @Param('tableId') tableId: string,
    @Body() dto: any,
  ) {
    return this.metadataService.createRelationship(tableId, dto);
  }

  @Post('relationships/:relationshipId/delete')
  @ApiOperation({ summary: '관계 삭제' })
  async deleteRelationship(@Param('relationshipId') relationshipId: string) {
    return this.metadataService.deleteRelationship(relationshipId);
  }

  // Legacy Endpoints Support (Optional: redirect to new methods or keep simple)
  // For now, keeping them simple or replacing implementation if exact same signature
}
