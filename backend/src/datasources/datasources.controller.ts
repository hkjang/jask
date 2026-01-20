import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DataSourcesService } from './datasources.service';
import { DataSourceAccessService } from './datasource-access.service';
import { CreateDataSourceDto, UpdateDataSourceDto, TestConnectionDto } from './dto/datasources.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('DataSources')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('datasources')
export class DataSourcesController {
  constructor(
    private readonly dataSourcesService: DataSourcesService,
    private readonly dataSourceAccessService: DataSourceAccessService,
  ) {}

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
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateDataSourceDto, @Request() req: any) {
    const auditContext = {
      userId: req.user?.sub,
      userEmail: req.user?.email,
      userName: req.user?.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.dataSourcesService.create(dto, auditContext);
  }

  @Get()
  @ApiOperation({ summary: '접근 가능한 데이터소스 목록 조회' })
  findAll(@Request() req: any) {
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    return this.dataSourcesService.findAllForUser(userId, userRole);
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
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateDataSourceDto, @Request() req: any) {
    const auditContext = {
      userId: req.user?.sub,
      userEmail: req.user?.email,
      userName: req.user?.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.dataSourcesService.update(id, dto, auditContext);
  }

  @Delete(':id')
  @ApiOperation({ summary: '데이터소스 삭제 (비활성화)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Request() req: any) {
    const auditContext = {
      userId: req.user?.sub,
      userEmail: req.user?.email,
      userName: req.user?.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.dataSourcesService.remove(id, auditContext);
  }

  @Post(':id/refresh-connection')
  @ApiOperation({ summary: '연결 새로고침' })
  refreshConnection(@Param('id') id: string) {
    return this.dataSourcesService.refreshConnection(id);
  }

  // ===========================================
  // Access Management Endpoints
  // ===========================================

  @Get(':id/users')
  @ApiOperation({ summary: '데이터소스 접근 사용자 목록' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getDataSourceUsers(@Param('id') id: string) {
    return this.dataSourceAccessService.getDataSourceUsers(id);
  }

  @Post(':id/grant')
  @ApiOperation({ summary: '데이터소스 접근 권한 부여' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  grantAccess(
    @Param('id') dataSourceId: string,
    @Body() body: { userId: string; role: 'VIEWER' | 'EDITOR' | 'ADMIN'; note?: string; expiresAt?: string },
    @Request() req: any,
  ) {
    const grantedBy = { id: req.user?.sub, name: req.user?.name || req.user?.email };
    const auditContext = {
      userId: req.user?.sub,
      userEmail: req.user?.email,
      userName: req.user?.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.dataSourceAccessService.grantAccess(
      {
        userId: body.userId,
        dataSourceId,
        role: body.role as any,
        note: body.note,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
      grantedBy,
      auditContext,
    );
  }

  @Put(':id/access/:userId')
  @ApiOperation({ summary: '데이터소스 접근 역할 변경' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateAccess(
    @Param('id') dataSourceId: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'VIEWER' | 'EDITOR' | 'ADMIN' },
    @Request() req: any,
  ) {
    const auditContext = {
      userId: req.user?.sub,
      userEmail: req.user?.email,
      userName: req.user?.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.dataSourceAccessService.updateAccess(userId, dataSourceId, body.role as any, auditContext);
  }

  @Delete(':id/revoke/:userId')
  @ApiOperation({ summary: '데이터소스 접근 권한 회수' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  revokeAccess(
    @Param('id') dataSourceId: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    const auditContext = {
      userId: req.user?.sub,
      userEmail: req.user?.email,
      userName: req.user?.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.dataSourceAccessService.revokeAccess(userId, dataSourceId, auditContext);
  }

  @Post(':id/bulk-grant')
  @ApiOperation({ summary: '다수 사용자에게 접근 권한 일괄 부여' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  bulkGrantAccess(
    @Param('id') dataSourceId: string,
    @Body() body: { userIds: string[]; role: 'VIEWER' | 'EDITOR' | 'ADMIN' },
    @Request() req: any,
  ) {
    const grantedBy = { id: req.user?.sub, name: req.user?.name || req.user?.email };
    const auditContext = {
      userId: req.user?.sub,
      userEmail: req.user?.email,
      userName: req.user?.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.dataSourceAccessService.bulkGrantAccess(
      dataSourceId,
      body.userIds,
      body.role as any,
      grantedBy,
      auditContext,
    );
  }

  @Post(':id/bulk-revoke')
  @ApiOperation({ summary: '다수 사용자 접근 권한 일괄 회수' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  bulkRevokeAccess(
    @Param('id') dataSourceId: string,
    @Body() body: { userIds: string[] },
    @Request() req: any,
  ) {
    const auditContext = {
      userId: req.user?.sub,
      userEmail: req.user?.email,
      userName: req.user?.name,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.dataSourceAccessService.bulkRevokeAccess(dataSourceId, body.userIds, auditContext);
  }
}

