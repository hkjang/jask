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
} from '@nestjs/common';
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
}

