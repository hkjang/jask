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

  @Get(':id')
  @ApiOperation({ summary: '데이터소스 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.dataSourcesService.findOne(id);
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

  @Post('test-connection')
  @ApiOperation({ summary: '연결 테스트' })
  testConnection(@Body() dto: TestConnectionDto) {
    return this.dataSourcesService.testConnection(dto);
  }
}
