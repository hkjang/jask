import { Controller, Post, Put, Get, Delete, Patch, Body, Param, Query, UseGuards, UploadedFile, UseInterceptors, Res, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as XLSX from 'xlsx';
import { MetadataService } from './metadata.service';
import { MetadataAiService } from './metadata-ai.service';
import { UpdateDescriptionDto, UpdateCodeValuesDto, ImportMetadataDto } from './dto/metadata.dto';

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
  async translateMetadata(
    @Param('dataSourceId') dataSourceId: string,
    @Query('untranslatedOnly') untranslatedOnly?: string,
  ) {
    const onlyUntranslated = untranslatedOnly === 'true';
    return this.metadataService.translateMetadata(dataSourceId, onlyUntranslated);
  }

  @Post('tables/:tableId/translate')
  @ApiOperation({ summary: '단일 테이블 AI 번역' })
  async translateTable(@Param('tableId') tableId: string) {
    return this.metadataService.translateSingleTable(tableId);
  }

  @Post('tables/:tableId/sync-ai')
  @ApiOperation({ summary: '단일 테이블 AI 동기화 (임베딩 재생성)' })
  async syncTableWithAI(@Param('tableId') tableId: string) {
    return this.metadataService.syncSingleTableWithAI(tableId);
  }

  @Patch('tables/:tableId/exclude')
  @ApiOperation({ summary: '테이블 AI 컨텍스트 제외/포함 토글' })
  async setTableExcluded(
    @Param('tableId') tableId: string,
    @Body() body: { isExcluded: boolean },
  ) {
    return this.metadataService.setTableExcluded(tableId, body.isExcluded);
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

  @Get('table-info')
  @ApiOperation({ summary: '테이블 상세 정보 조회 (이름 기반)' })
  async getTableInfoByName(
    @Query('dataSourceId') dataSourceId: string,
    @Query('tableName') tableName: string,
  ) {
    return this.metadataService.getTableInfoByName(dataSourceId, tableName);
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

  // --- Column Exclusion & Deletion ---

  @Patch('column/:columnId/exclude')
  @ApiOperation({ summary: '컬럼 제외 상태 토글' })
  async setColumnExcluded(
    @Param('columnId') columnId: string,
    @Body() body: { isExcluded: boolean },
  ) {
    return this.metadataService.setColumnExcluded(columnId, body.isExcluded);
  }

  @Delete('column/:columnId')
  @ApiOperation({ summary: '컬럼 삭제' })
  async deleteColumn(@Param('columnId') columnId: string) {
    return this.metadataService.deleteColumn(columnId);
  }

  // --- Excel Import/Export ---

  @Get(':dataSourceId/export')
  @ApiOperation({ summary: '메타데이터 Excel 내보내기' })
  async exportMetadata(
    @Param('dataSourceId') dataSourceId: string,
    @Res() res: Response,
  ) {
    const rows = await this.metadataService.exportMetadataToExcel(dataSourceId);
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Metadata');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="metadata_${dataSourceId}.xlsx"`);
    res.send(buffer);
  }

  @Post(':dataSourceId/import')
  @ApiOperation({ summary: '메타데이터 Excel 가져오기' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importMetadata(
    @Param('dataSourceId') dataSourceId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('File is required');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    return this.metadataService.importMetadataFromExcel(dataSourceId, rows);
  }

  @Get('template/download')
  @ApiOperation({ summary: 'Excel 템플릿 다운로드' })
  async downloadTemplate(@Res() res: Response) {
    const rows = this.metadataService.getExcelTemplate();
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="metadata_template.xlsx"');
    res.send(buffer);
  }

  // Legacy Endpoints Support (Optional: redirect to new methods or keep simple)
  // For now, keeping them simple or replacing implementation if exact same signature
}
