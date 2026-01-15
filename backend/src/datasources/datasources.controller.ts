import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DataSourcesService } from './datasources.service';
import { CreateDataSourceDto, UpdateDataSourceDto, TestConnectionDto } from './dto/datasources.dto';

@ApiTags('DataSources')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('datasources')
export class DataSourcesController {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  // 정적 라우트를 먼저 정의 (동적 :id 라우트보다 앞에)
  @Get('overview')
  @ApiOperation({ summary: '대시보드 개요 조회' })
  getOverview() {
    return this.dataSourcesService.getOverview();
  }

  @Get('templates')
  @ApiOperation({ summary: '연결 템플릿 목록' })
  getConnectionTemplates() {
    return this.dataSourcesService.getConnectionTemplates();
  }

  @Post('test-connection')
  @ApiOperation({ summary: '연결 테스트' })
  testConnection(@Body() dto: TestConnectionDto) {
    return this.dataSourcesService.testConnection(dto);
  }

  @Post()
  @ApiOperation({ summary: '데이터소스 생성' })
  create(@Body() dto: CreateDataSourceDto) {
    return this.dataSourcesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '데이터소스 목록 조회' })
  findAll() {
    return this.dataSourcesService.findAll();
  }

  // 동적 라우트 (:id 파라미터)
  @Get(':id')
  @ApiOperation({ summary: '데이터소스 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.dataSourcesService.findOne(id);
  }

  @Get(':id/health')
  @ApiOperation({ summary: '헬스 체크' })
  checkHealth(@Param('id') id: string) {
    return this.dataSourcesService.checkHealth(id);
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: '통계 조회' })
  getStatistics(@Param('id') id: string) {
    return this.dataSourcesService.getStatistics(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '데이터소스 수정' })
  update(@Param('id') id: string, @Body() dto: UpdateDataSourceDto) {
    return this.dataSourcesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '데이터소스 삭제 (비활성화)' })
  remove(@Param('id') id: string) {
    return this.dataSourcesService.remove(id);
  }

  @Post(':id/refresh-connection')
  @ApiOperation({ summary: '연결 새로고침' })
  refreshConnection(@Param('id') id: string) {
    return this.dataSourcesService.refreshConnection(id);
  }
}

