import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuditService, AuditLogFilter } from './audit.service';
import { AuditActionType, AuditSeverity } from '@prisma/client';

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
    @Query('severity') severity?: AuditSeverity,
    @Query('userId') userId?: string,
    @Query('dataSourceId') dataSourceId?: string,
    @Query('success') success?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const filter: AuditLogFilter = {
      actionType,
      severity,
      userId,
      dataSourceId,
      success: success !== undefined ? success === 'true' : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
    };

    return this.auditService.findAll(filter, parseInt(page), parseInt(limit));
  }

  /**
   * 감사 로그 통계
   */
  @Get('stats')
  async getStats(@Query('days') days = '7') {
    return this.auditService.getStats(parseInt(days));
  }

  /**
   * 감사 로그 내보내기 (CSV)
   */
  @Get('export')
  async exportCSV(
    @Res() res: Response,
    @Query('actionType') actionType?: AuditActionType,
    @Query('severity') severity?: AuditSeverity,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const filter: AuditLogFilter = {
      actionType,
      severity,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
    };

    const csv = await this.auditService.exportCSV(filter);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  }

  /**
   * Action Type 목록
   */
  @Get('action-types')
  getActionTypes() {
    return Object.values(AuditActionType);
  }

  /**
   * Severity 목록
   */
  @Get('severities')
  getSeverities() {
    return Object.values(AuditSeverity);
  }
}
