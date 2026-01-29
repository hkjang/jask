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

  @Post('llm-providers/test')
  @ApiOperation({ summary: 'LLM 프로바이더 연결 테스트' })
  testLLMProvider(@Body() body: any) {
    return this.adminService.testLLMProvider(body);
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

  @Get('users/:id')
  @ApiOperation({ summary: '사용자 상세 조회' })
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Post('users')
  @ApiOperation({ summary: '사용자 생성' })
  createUser(@Body() body: { email: string; password: string; name: string; role?: 'USER' | 'ADMIN'; department?: string }) {
    return this.adminService.createUser(body);
  }

  @Put('users/:id')
  @ApiOperation({ summary: '사용자 정보 수정' })
  updateUser(@Param('id') id: string, @Body() body: { name?: string; department?: string; email?: string }) {
    return this.adminService.updateUser(id, body);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: '사용자 삭제' })
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
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

  @Post('sample-queries/bulk')
  @ApiOperation({ summary: '샘플 쿼리 일괄 작업' })
  bulkUpdateSampleQueries(@Body() body: { ids: string[]; action: 'DELETE' | 'ACTIVATE' | 'DEACTIVATE' }) {
    return this.adminService.bulkUpdateSampleQueries(body.ids, body.action);
  }

  @Post('sample-queries/test')
  @ApiOperation({ summary: '샘플 쿼리 테스트 (실행)' })
  testSampleQuery(@Body() body: { dataSourceId: string; sql: string }) {
    return this.adminService.testSampleQuery(body.dataSourceId, body.sql);
  }

  @Post('sample-queries/fix')
  @ApiOperation({ summary: '샘플 쿼리 자동 수정 (AI)' })
  fixSampleQuery(@Body() body: { dataSourceId: string; sql: string; error: string }) {
    return this.adminService.fixSampleQuery(body.dataSourceId, body.sql, body.error);
  }

  @Post('sample-queries/generate')
  @ApiOperation({ summary: 'AI로 샘플 쿼리 생성 (저장 안함)' })
  generateAISampleQueries(@Body() body: { dataSourceId: string; count?: number; tableNames?: string[] }) {
    return this.adminService.generateAISampleQueries(body.dataSourceId, body.count, body.tableNames);
  }

  @Get('sample-queries/prompts')
  @ApiOperation({ summary: 'AI 샘플 쿼리 생성 프롬프트 정보 조회' })
  getSampleQueryPrompts() {
    return this.adminService.getSampleQueryPrompts();
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

  // ==========================================
  // 추천 질문 관리
  // ==========================================
  @Get('recommended-questions')
  @ApiOperation({ summary: '추천 질문 목록' })
  getRecommendedQuestions(
    @Query('dataSourceId') dataSourceId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
  ) {
    return this.adminService.getRecommendedQuestions(
      dataSourceId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
      source,
    );
  }

  @Get('recommended-questions/stats')
  @ApiOperation({ summary: '추천 질문 통계' })
  getRecommendedQuestionsStats(@Query('dataSourceId') dataSourceId?: string) {
    return this.adminService.getRecommendedQuestionsStats(dataSourceId);
  }

  @Get('recommended-questions/:id')
  @ApiOperation({ summary: '추천 질문 상세 조회' })
  getRecommendedQuestion(@Param('id') id: string) {
    return this.adminService.getRecommendedQuestion(id);
  }

  @Post('recommended-questions')
  @ApiOperation({ summary: '추천 질문 생성' })
  createRecommendedQuestion(@Body() body: {
    dataSourceId: string;
    question: string;
    category?: string;
    tags?: string[];
    description?: string;
  }) {
    return this.adminService.createRecommendedQuestion(body);
  }

  @Put('recommended-questions/:id')
  @ApiOperation({ summary: '추천 질문 수정' })
  updateRecommendedQuestion(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateRecommendedQuestion(id, body);
  }

  @Delete('recommended-questions/:id')
  @ApiOperation({ summary: '추천 질문 삭제' })
  deleteRecommendedQuestion(@Param('id') id: string) {
    return this.adminService.deleteRecommendedQuestion(id);
  }

  @Put('recommended-questions/:id/toggle')
  @ApiOperation({ summary: '추천 질문 활성화/비활성화 토글' })
  toggleRecommendedQuestion(@Param('id') id: string) {
    return this.adminService.toggleRecommendedQuestion(id);
  }


  @Post('recommended-questions/generate')
  @ApiOperation({ summary: 'AI로 추천 질문 생성' })
  generateAIRecommendedQuestions(
    @Body() body: { dataSourceId: string; count?: number }
  ) {
    return this.adminService.generateAIRecommendedQuestions(body.dataSourceId, body.count);
  }

  // ==========================================
  // 피드백 관리 (Feedback Management)
  // ==========================================
  @Get('feedback')
  @ApiOperation({ summary: '피드백 목록 조회' })
  getFeedbackList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('feedback') feedback?: 'POSITIVE' | 'NEGATIVE',
    @Query('dataSourceId') dataSourceId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('hasNote') hasNote?: string,
  ) {
    return this.adminService.getFeedbackList({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      feedback,
      dataSourceId,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
      hasNote: hasNote === 'true' ? true : hasNote === 'false' ? false : undefined,
    });
  }

  @Get('feedback/stats')
  @ApiOperation({ summary: '피드백 통계' })
  getFeedbackStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('dataSourceId') dataSourceId?: string,
  ) {
    return this.adminService.getFeedbackStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      dataSourceId,
    });
  }

  @Get('feedback/:id')
  @ApiOperation({ summary: '피드백 상세 조회' })
  getFeedbackById(@Param('id') id: string) {
    return this.adminService.getFeedbackById(id);
  }

  @Put('feedback/:id')
  @ApiOperation({ summary: '피드백 메모 수정' })
  updateFeedback(
    @Param('id') id: string,
    @Body() body: { feedbackNote?: string },
  ) {
    return this.adminService.updateFeedback(id, body);
  }

  @Delete('feedback/:id')
  @ApiOperation({ summary: '피드백 삭제' })
  deleteFeedback(@Param('id') id: string) {
    return this.adminService.deleteFeedback(id);
  }

  @Post('feedback/bulk-delete')
  @ApiOperation({ summary: '피드백 일괄 삭제' })
  deleteFeedbackBulk(@Body() body: { ids: string[] }) {
    return this.adminService.deleteFeedbackBulk(body.ids);
  }

  @Post('feedback/export')
  @ApiOperation({ summary: '피드백 CSV 내보내기' })
  exportFeedback(
    @Body() body: {
      feedback?: 'POSITIVE' | 'NEGATIVE';
      dataSourceId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.adminService.exportFeedback({
      feedback: body.feedback,
      dataSourceId: body.dataSourceId,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
  }
}
