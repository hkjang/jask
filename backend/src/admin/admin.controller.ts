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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 대시보드
  @Get('dashboard')
  @ApiOperation({ summary: '관리자 대시보드 통계' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // LLM 프로바이더
  @Get('llm-providers')
  @ApiOperation({ summary: 'LLM 프로바이더 목록' })
  getLLMProviders() {
    return this.adminService.getLLMProviders();
  }

  @Post('llm-providers')
  @ApiOperation({ summary: 'LLM 프로바이더 생성' })
  createLLMProvider(@Body() body: any) {
    return this.adminService.createLLMProvider(body);
  }

  @Put('llm-providers/:id')
  @ApiOperation({ summary: 'LLM 프로바이더 수정' })
  updateLLMProvider(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateLLMProvider(id, body);
  }

  @Delete('llm-providers/:id')
  @ApiOperation({ summary: 'LLM 프로바이더 삭제' })
  deleteLLMProvider(@Param('id') id: string) {
    return this.adminService.deleteLLMProvider(id);
  }

  // 시스템 설정
  @Get('settings')
  @ApiOperation({ summary: '시스템 설정 조회' })
  getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings/:key')
  @ApiOperation({ summary: '시스템 설정 수정' })
  updateSetting(
    @Param('key') key: string,
    @Body() body: { value: any; description?: string },
  ) {
    return this.adminService.updateSetting(key, body.value, body.description);
  }

  // 사용자 관리
  @Get('users')
  @ApiOperation({ summary: '사용자 목록' })
  getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: '사용자 권한 변경' })
  updateUserRole(
    @Param('id') id: string,
    @Body() body: { role: 'USER' | 'ADMIN' },
  ) {
    return this.adminService.updateUserRole(id, body.role);
  }

  @Put('users/:id/toggle-active')
  @ApiOperation({ summary: '사용자 활성화 토글' })
  toggleUserActive(@Param('id') id: string) {
    return this.adminService.toggleUserActive(id);
  }

  // 대화 이력 (관리자용)
  @Get('threads')
  @ApiOperation({ summary: '전체 대화 이력' })
  getAllThreads(
      @Query('page') page?: string, 
      @Query('limit') limit?: string,
      @Query('q') q?: string
  ) {
    return this.adminService.getAllThreads(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      q
    );
  }

  // 샘플 쿼리
  @Get('sample-queries')
  @ApiOperation({ summary: '샘플 쿼리 목록' })
  getSampleQueries(@Query('dataSourceId') dataSourceId?: string) {
    return this.adminService.getSampleQueries(dataSourceId);
  }

  @Post('sample-queries')
  @ApiOperation({ summary: '샘플 쿼리 생성' })
  createSampleQuery(@Body() body: any) {
    return this.adminService.createSampleQuery(body);
  }

  @Put('sample-queries/:id')
  @ApiOperation({ summary: '샘플 쿼리 수정' })
  updateSampleQuery(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateSampleQuery(id, body);
  }

  @Delete('sample-queries/:id')
  @ApiOperation({ summary: '샘플 쿼리 삭제' })
  deleteSampleQuery(@Param('id') id: string) {
    return this.adminService.deleteSampleQuery(id);
  }

  // 프롬프트 템플릿
  @Get('prompt-templates')
  @ApiOperation({ summary: '프롬프트 템플릿 목록' })
  getPromptTemplates() {
    return this.adminService.getPromptTemplates();
  }

  @Post('prompt-templates')
  @ApiOperation({ summary: '프롬프트 템플릿 생성' })
  createPromptTemplate(@Body() body: any) {
    return this.adminService.createPromptTemplate(body);
  }

  @Put('prompt-templates/:id')
  @ApiOperation({ summary: '프롬프트 템플릿 수정' })
  updatePromptTemplate(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePromptTemplate(id, body);
  }

  @Delete('prompt-templates/:id')
  @ApiOperation({ summary: '프롬프트 템플릿 삭제' })
  deletePromptTemplate(@Param('id') id: string) {
    return this.adminService.deletePromptTemplate(id);
  }

  // 정책 관리 (Governance)
  @Get('policies')
  @ApiOperation({ summary: '정책 목록' })
  getPolicies() {
    return this.adminService.getPolicies();
  }

  @Post('policies')
  @ApiOperation({ summary: '정책 생성' })
  createPolicy(@Body() body: any) {
    return this.adminService.createPolicy(body);
  }

  @Put('policies/:id')
  @ApiOperation({ summary: '정책 수정' })
  updatePolicy(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePolicy(id, body);
  }

  @Delete('policies/:id')
  @ApiOperation({ summary: '정책 삭제' })
  deletePolicy(@Param('id') id: string) {
    return this.adminService.deletePolicy(id);
  }

  @Post('policies/simulate')
  @ApiOperation({ summary: '정책 영향도 시뮬레이션' })
  simulatePolicy(@Body() body: { config: any }) {
    return this.adminService.simulatePolicy(body.config);
  }
}
