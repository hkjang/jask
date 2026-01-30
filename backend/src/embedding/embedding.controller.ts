import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmbeddingService } from './embedding.service';
import {
  CreateEmbeddingConfigDto,
  UpdateEmbeddingConfigDto,
  CreateEmbeddableItemDto,
  UpdateEmbeddableItemDto,
  ListEmbeddableItemsDto,
  BatchEmbedDto,
  SearchDto,
} from './dto/embedding.dto';

@Controller('embedding')
@UseGuards(JwtAuthGuard)
export class EmbeddingController {
  constructor(private readonly embeddingService: EmbeddingService) {}

  // ===========================================
  // Embedding Config Endpoints
  // ===========================================

  @Post('configs')
  async createConfig(@Body() dto: CreateEmbeddingConfigDto) {
    return this.embeddingService.createConfig(dto);
  }

  @Get('configs')
  async listConfigs(@Query('dataSourceId') dataSourceId?: string) {
    return this.embeddingService.listConfigs(dataSourceId);
  }

  @Get('configs/:id')
  async getConfig(@Param('id') id: string) {
    return this.embeddingService.getConfig(id);
  }

  @Put('configs/:id')
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateEmbeddingConfigDto,
  ) {
    return this.embeddingService.updateConfig(id, dto);
  }

  @Delete('configs/:id')
  async deleteConfig(@Param('id') id: string) {
    return this.embeddingService.deleteConfig(id);
  }

  // ===========================================
  // Embeddable Item Endpoints
  // ===========================================

  @Post('items')
  async createItem(@Body() dto: CreateEmbeddableItemDto) {
    return this.embeddingService.createItem(dto);
  }

  @Get('items')
  async listItems(@Query() query: ListEmbeddableItemsDto) {
    return this.embeddingService.listItems(query);
  }

  @Get('items/:id')
  async getItem(@Param('id') id: string) {
    return this.embeddingService.getItem(id);
  }

  @Put('items/:id')
  async updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateEmbeddableItemDto,
  ) {
    return this.embeddingService.updateItem(id, dto);
  }

  @Delete('items/:id')
  async deleteItem(@Param('id') id: string) {
    return this.embeddingService.deleteItem(id);
  }

  // ===========================================
  // Embedding Generation Endpoints
  // ===========================================

  @Post('items/:id/embed')
  async generateEmbedding(@Param('id') id: string) {
    return this.embeddingService.generateEmbedding(id);
  }

  @Post('batch-embed')
  async batchGenerateEmbeddings(@Body() dto: BatchEmbedDto) {
    return this.embeddingService.batchGenerateEmbeddings(dto);
  }

  // ===========================================
  // Search Endpoints
  // ===========================================

  @Post('search')
  async search(@Body() dto: SearchDto) {
    return this.embeddingService.search(dto);
  }

  @Post('search/schema')
  async searchSchema(
    @Body()
    dto: {
      dataSourceId: string;
      question: string;
      limit?: number;
      searchMethod?: 'DENSE' | 'SPARSE' | 'HYBRID';
    },
  ) {
    return this.embeddingService.searchSchemaContext(
      dto.dataSourceId,
      dto.question,
      dto.limit ?? 20,
      dto.searchMethod as any,
    );
  }

  // ===========================================
  // Sync Endpoints (자동 동기화)
  // ===========================================

  @Post('sync/table/:tableId')
  async syncTableEmbedding(@Param('tableId') tableId: string) {
    await this.embeddingService.syncTableEmbedding(tableId);
    return { success: true, message: 'Table embedding synced' };
  }

  @Post('sync/datasource/:dataSourceId')
  async syncDataSourceEmbeddings(@Param('dataSourceId') dataSourceId: string) {
    return this.embeddingService.syncDataSourceEmbeddings(dataSourceId);
  }

  @Post('sync/sample-query/:sampleQueryId')
  async syncSampleQueryEmbedding(@Param('sampleQueryId') sampleQueryId: string) {
    await this.embeddingService.syncSampleQueryEmbedding(sampleQueryId);
    return { success: true, message: 'Sample query embedding synced' };
  }

  @Post('sync/all')
  async syncAllEmbeddings() {
    return this.embeddingService.syncAllEmbeddings();
  }

  // ===========================================
  // Column Embedding Endpoints (컬럼 임베딩)
  // ===========================================

  @Put('column/:columnId/aliases')
  async updateColumnAliases(
    @Param('columnId') columnId: string,
    @Body('aliases') aliases: string[],
  ) {
    await this.embeddingService.updateColumnAliases(columnId, aliases);
    return { success: true, message: '컬럼 동의어가 업데이트되었습니다.' };
  }

  @Post('sync/column/:columnId')
  async syncColumnEmbedding(@Param('columnId') columnId: string) {
    await this.embeddingService.syncColumnEmbedding(columnId);
    return { success: true, message: '컬럼 임베딩이 동기화되었습니다.' };
  }

  @Post('sync/table/:tableId/columns')
  async syncTableColumnsEmbeddings(@Param('tableId') tableId: string) {
    return this.embeddingService.syncTableColumnsEmbeddings(tableId);
  }

  @Post('sync/datasource/:dataSourceId/columns')
  async syncDataSourceColumnsEmbeddings(
    @Param('dataSourceId') dataSourceId: string,
  ) {
    return this.embeddingService.syncDataSourceColumnsEmbeddings(dataSourceId);
  }

  // ===========================================
  // Document Endpoints (문서 관리)
  // ===========================================

  @Post('documents')
  async createDocument(
    @Body()
    dto: {
      name: string;
      title?: string;
      description?: string;
      content: string;
      mimeType: string;
      fileSize: number;
      dataSourceId?: string;
      tags?: string[];
      category?: string;
      chunkSize?: number;
      chunkOverlap?: number;
    },
    @Request() req: any,
  ) {
    return this.embeddingService.createDocument(
      dto,
      req.user?.id,
      req.user?.name,
    );
  }

  @Get('documents')
  async listDocuments(
    @Query('dataSourceId') dataSourceId?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.embeddingService.listDocuments({
      dataSourceId,
      isActive: isActive ? isActive === 'true' : undefined,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('documents/:id')
  async getDocument(@Param('id') id: string) {
    return this.embeddingService.getDocument(id);
  }

  @Put('documents/:id')
  async updateDocument(
    @Param('id') id: string,
    @Body()
    dto: {
      title?: string;
      description?: string;
      tags?: string[];
      category?: string;
      isActive?: boolean;
    },
  ) {
    return this.embeddingService.updateDocument(id, dto);
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string) {
    await this.embeddingService.deleteDocument(id);
    return { success: true, message: '문서가 삭제되었습니다.' };
  }

  @Post('documents/:id/sync')
  async syncDocumentEmbeddings(@Param('id') id: string) {
    return this.embeddingService.syncDocumentEmbeddings(id);
  }

  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('dataSourceId') dataSourceId: string,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('tags') tags: string,
    @Body('category') category: string,
    @Body('chunkSize') chunkSize: string,
    @Body('chunkOverlap') chunkOverlap: string,
    @Request() req: any,
  ) {
    // 파일 타입 검증
    const allowedMimes = [
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/octet-stream', // 일부 .md 파일
    ];
    const allowedExtensions = ['.txt', '.md', '.csv'];

    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    if (
      !allowedMimes.includes(file.mimetype) &&
      !allowedExtensions.includes(fileExtension)
    ) {
      throw new HttpException(
        '지원되지 않는 파일 형식입니다. .txt, .md, .csv 파일만 업로드 가능합니다.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 파일 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new HttpException(
        '파일 크기가 너무 큽니다. 최대 5MB까지 업로드 가능합니다.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const content = file.buffer.toString('utf-8');
    const parsedTags = tags ? JSON.parse(tags) : [];

    return this.embeddingService.createDocument(
      {
        name: file.originalname,
        title: title || undefined,
        description: description || undefined,
        content,
        mimeType: file.mimetype,
        fileSize: file.size,
        dataSourceId: dataSourceId || undefined,
        tags: parsedTags,
        category: category || undefined,
        chunkSize: chunkSize ? parseInt(chunkSize, 10) : undefined,
        chunkOverlap: chunkOverlap ? parseInt(chunkOverlap, 10) : undefined,
      },
      req.user?.id,
      req.user?.name,
    );
  }
}

