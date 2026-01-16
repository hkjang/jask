import { Controller, Get, Put, Query, Param, Body, Res, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { AuditService, AuditLogFilter, SecurityAlertFilter } from './audit.service';
import { AuditActionType, AuditSeverity, AuditCategory, AlertStatus } from '@prisma/client';

@Controller('admin/audit')
@UseGuards(AuthGuard('jwt'))
export class AuditController {
  constructor(private auditService: AuditService) {}

  /**
   * 감사 로그 목록 조회
   */
  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('actionType') actionType?: AuditActionType,
    @Query('category') category?: AuditCategory,
    @Query('severity') severity?: AuditSeverity,
    @Query('userId') userId?: string,
    @Query('dataSourceId') dataSourceId?: string,
    @Query('success') success?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('sessionId') sessionId?: string,
    @Query('minRiskScore') minRiskScore?: string,
  ) {
    const filter: AuditLogFilter = {
      actionType,
      category,
      severity,
      userId,
      dataSourceId,
      success: success !== undefined ? success === 'true' : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
      ipAddress,
      sessionId,
      minRiskScore: minRiskScore ? parseInt(minRiskScore) : undefined,
    };

    return this.auditService.findAll(filter, parseInt(page), parseInt(limit));
  }

  /**
   * 감사 로그 상세 조회
   */
  @Get('log/:id')
  async findById(@Param('id') id: string) {
    return this.auditService.findById(id);
  }

  /**
   * 감사 로그 통계
   */
  @Get('stats')
  async getStats(@Query('days') days = '7') {
    return this.auditService.getStats(parseInt(days));
  }

  /**
   * 이상 징후 감지
   */
  @Get('anomalies')
  async getAnomalies(@Query('days') days = '7') {
    return this.auditService.getAnomalies(parseInt(days));
  }

  /**
   * 사용자 타임라인
   */
  @Get('user/:userId/timeline')
  async getUserTimeline(
    @Param('userId') userId: string,
    @Query('days') days = '7',
  ) {
    return this.auditService.getUserTimeline(userId, parseInt(days));
  }

  /**
   * 세션별 로그
   */
  @Get('session/:sessionId')
  async getSessionLogs(@Param('sessionId') sessionId: string) {
    return this.auditService.getSessionLogs(sessionId);
  }

  /**
   * 활성 세션 목록
   */
  @Get('sessions/active')
  async getActiveSessions() {
    return this.auditService.getActiveSessions();
  }

  /**
   * 보안 경고 목록
   */
  @Get('security-alerts')
  async getSecurityAlerts(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('alertType') alertType?: string,
    @Query('status') status?: AlertStatus,
    @Query('severity') severity?: AuditSeverity,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filter: SecurityAlertFilter = {
      alertType,
      status,
      severity,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.auditService.getSecurityAlerts(filter, parseInt(page), parseInt(limit));
  }

  /**
   * 보안 경고 확인 처리
   */
  @Put('security-alerts/:id/acknowledge')
  async acknowledgeAlert(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    await this.auditService.acknowledgeAlert(id, user?.email || 'unknown');
    return { success: true };
  }

  /**
   * 보안 경고 해결 처리
   */
  @Put('security-alerts/:id/resolve')
  async resolveAlert(
    @Param('id') id: string,
    @Body() body: { resolution: string },
    @Req() req: Request,
  ) {
    const user = req.user as any;
    await this.auditService.resolveAlert(id, user?.email || 'unknown', body.resolution);
    return { success: true };
  }

  /**
   * 보안 경고 무시 처리
   */
  @Put('security-alerts/:id/dismiss')
  async dismissAlert(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    await this.auditService.dismissAlert(id, user?.email || 'unknown');
    return { success: true };
  }

  /**
   * 감사 로그 내보내기 (CSV)
   */
  @Get('export')
  async exportCSV(
    @Res() res: Response,
    @Query('actionType') actionType?: AuditActionType,
    @Query('category') category?: AuditCategory,
    @Query('severity') severity?: AuditSeverity,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('minRiskScore') minRiskScore?: string,
  ) {
    const filter: AuditLogFilter = {
      actionType,
      category,
      severity,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
      minRiskScore: minRiskScore ? parseInt(minRiskScore) : undefined,
    };

    const csv = await this.auditService.exportCSV(filter);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv); // BOM for Excel Korean support
  }

  /**
   * Action Type 목록
   */
  @Get('action-types')
  getActionTypes() {
    return Object.values(AuditActionType);
  }

  /**
   * Category 목록
   */
  @Get('categories')
  getCategories() {
    return Object.values(AuditCategory);
  }

  /**
   * Severity 목록
   */
  @Get('severities')
  getSeverities() {
    return Object.values(AuditSeverity);
  }

  /**
   * Alert Status 목록
   */
  @Get('alert-statuses')
  getAlertStatuses() {
    return Object.values(AlertStatus);
  }
}
