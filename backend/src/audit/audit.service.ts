import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActionType, AuditSeverity } from '@prisma/client';

export interface CreateAuditLogDto {
  actionType: AuditActionType;
  severity?: AuditSeverity;
  description: string;
  sqlQuery?: string;
  tableName?: string;
  affectedRows?: number;
  userId?: string;
  userEmail?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  dataSourceId?: string;
  dataSourceName?: string;
  success?: boolean;
  errorMessage?: string;
  executionTime?: number;
  metadata?: any;
}

export interface AuditLogFilter {
  actionType?: AuditActionType;
  severity?: AuditSeverity;
  userId?: string;
  dataSourceId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 감사 로그 생성
   */
  async log(data: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actionType: data.actionType,
          severity: data.severity || AuditSeverity.INFO,
          description: data.description,
          sqlQuery: data.sqlQuery,
          tableName: data.tableName,
          affectedRows: data.affectedRows,
          userId: data.userId,
          userEmail: data.userEmail,
          userName: data.userName,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          dataSourceId: data.dataSourceId,
          dataSourceName: data.dataSourceName,
          success: data.success ?? true,
          errorMessage: data.errorMessage,
          executionTime: data.executionTime,
          metadata: data.metadata,
        },
      });
    } catch (error) {
      // 감사 로그 실패가 메인 작업을 방해하지 않도록
      this.logger.error(`감사 로그 저장 실패: ${error.message}`);
    }
  }

  /**
   * DDL 작업 로그
   */
  async logDDL(
    operation: 'CREATE' | 'ALTER' | 'DROP' | 'TRUNCATE',
    description: string,
    options: Partial<CreateAuditLogDto>,
  ): Promise<void> {
    const actionTypeMap = {
      CREATE: AuditActionType.DDL_CREATE,
      ALTER: AuditActionType.DDL_ALTER,
      DROP: AuditActionType.DDL_DROP,
      TRUNCATE: AuditActionType.DDL_TRUNCATE,
    };

    const severityMap = {
      CREATE: AuditSeverity.INFO,
      ALTER: AuditSeverity.WARNING,
      DROP: AuditSeverity.CRITICAL,
      TRUNCATE: AuditSeverity.CRITICAL,
    };

    await this.log({
      actionType: actionTypeMap[operation],
      severity: severityMap[operation],
      description,
      ...options,
    });
  }

  /**
   * DML 작업 로그
   */
  async logDML(
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    description: string,
    options: Partial<CreateAuditLogDto>,
  ): Promise<void> {
    const actionTypeMap = {
      INSERT: AuditActionType.DML_INSERT,
      UPDATE: AuditActionType.DML_UPDATE,
      DELETE: AuditActionType.DML_DELETE,
    };

    const severityMap = {
      INSERT: AuditSeverity.INFO,
      UPDATE: AuditSeverity.WARNING,
      DELETE: AuditSeverity.DANGER,
    };

    await this.log({
      actionType: actionTypeMap[operation],
      severity: severityMap[operation],
      description,
      ...options,
    });
  }

  /**
   * 감사 로그 목록 조회
   */
  async findAll(filter: AuditLogFilter, page = 1, limit = 50) {
    const where: any = {};

    if (filter.actionType) where.actionType = filter.actionType;
    if (filter.severity) where.severity = filter.severity;
    if (filter.userId) where.userId = filter.userId;
    if (filter.dataSourceId) where.dataSourceId = filter.dataSourceId;
    if (filter.success !== undefined) where.success = filter.success;
    
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = filter.startDate;
      if (filter.endDate) where.createdAt.lte = filter.endDate;
    }

    if (filter.search) {
      where.OR = [
        { description: { contains: filter.search, mode: 'insensitive' } },
        { sqlQuery: { contains: filter.search, mode: 'insensitive' } },
        { userEmail: { contains: filter.search, mode: 'insensitive' } },
        { tableName: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 통계 조회
   */
  async getStats(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [byActionType, bySeverity, byDay, recentCritical] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['actionType'],
        _count: true,
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['severity'],
        _count: true,
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.$queryRaw`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,
      this.prisma.auditLog.findMany({
        where: { 
          severity: { in: [AuditSeverity.CRITICAL, AuditSeverity.DANGER] },
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    return {
      byActionType,
      bySeverity,
      byDay,
      recentCritical,
    };
  }

  /**
   * 로그 내보내기 (CSV)
   */
  async exportCSV(filter: AuditLogFilter): Promise<string> {
    const { items } = await this.findAll(filter, 1, 10000);

    const headers = [
      'ID', 'Timestamp', 'Action Type', 'Severity', 'Description',
      'User Email', 'User Name', 'Data Source', 'Table', 
      'Affected Rows', 'Success', 'Error Message', 'IP Address',
    ];

    const rows = items.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.actionType,
      log.severity,
      `"${(log.description || '').replace(/"/g, '""')}"`,
      log.userEmail || '',
      log.userName || '',
      log.dataSourceName || '',
      log.tableName || '',
      log.affectedRows || '',
      log.success ? 'Yes' : 'No',
      `"${(log.errorMessage || '').replace(/"/g, '""')}"`,
      log.ipAddress || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
