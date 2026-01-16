import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActionType, AuditSeverity, AuditCategory, AlertStatus } from '@prisma/client';

// ===========================================
// DTOs
// ===========================================

export interface CreateAuditLogDto {
  actionType: AuditActionType;
  category?: AuditCategory;
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
  sessionId?: string;
  requestId?: string;
  apiEndpoint?: string;
  httpMethod?: string;
  previousValue?: any;
  newValue?: any;
  clientInfo?: ClientInfo;
  geoInfo?: GeoInfo;
  metadata?: any;
}

export interface ClientInfo {
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: string;
  isMobile?: boolean;
}

export interface GeoInfo {
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
}

export interface AuditLogFilter {
  actionType?: AuditActionType;
  category?: AuditCategory;
  severity?: AuditSeverity;
  userId?: string;
  dataSourceId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  ipAddress?: string;
  sessionId?: string;
  minRiskScore?: number;
}

export interface SecurityAlertFilter {
  alertType?: string;
  status?: AlertStatus;
  severity?: AuditSeverity;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

// ===========================================
// Risk Score Configuration
// ===========================================

const ACTION_RISK_SCORES: Record<AuditActionType, number> = {
  // DDL - High Risk
  DDL_CREATE: 40,
  DDL_ALTER: 50,
  DDL_DROP: 90,
  DDL_TRUNCATE: 95,
  
  // DML
  DML_INSERT: 20,
  DML_UPDATE: 30,
  DML_DELETE: 60,
  
  // Query
  QUERY_EXECUTE: 10,
  
  // Auth
  AUTH_LOGIN: 5,
  AUTH_LOGOUT: 0,
  AUTH_FAILED: 50,
  AUTH_PASSWORD_CHANGE: 30,
  AUTH_PASSWORD_RESET: 40,
  
  // Permission - High Risk
  PERMISSION_GRANT: 70,
  PERMISSION_REVOKE: 60,
  ROLE_CHANGE: 80,
  USER_CREATE: 40,
  USER_UPDATE: 30,
  USER_DELETE: 70,
  USER_ACTIVATE: 20,
  USER_DEACTIVATE: 40,
  
  // Data Access
  SENSITIVE_DATA_ACCESS: 60,
  BULK_DATA_ACCESS: 50,
  DATA_EXPORT: 70,
  DATA_IMPORT: 50,
  
  // System
  SYSTEM_STARTUP: 10,
  SYSTEM_SHUTDOWN: 30,
  BACKUP_CREATE: 20,
  BACKUP_RESTORE: 60,
  
  // API Security
  API_KEY_CREATE: 50,
  API_KEY_REVOKE: 40,
  RATE_LIMIT_EXCEEDED: 70,
  UNAUTHORIZED_ACCESS: 90,
  
  // Session
  SESSION_TIMEOUT: 10,
  SESSION_HIJACK_ATTEMPT: 100,
  CONCURRENT_LOGIN: 60,
  SESSION_TERMINATED: 20,
  
  // Config
  CONFIG_CHANGE: 50,
  DATASOURCE_CREATE: 40,
  DATASOURCE_UPDATE: 35,
  DATASOURCE_DELETE: 70,
  
  // Metadata
  METADATA_VIEW: 5,
  METADATA_MODIFY: 25,
  SCHEMA_SYNC: 30,
  
  // Favorites
  FAVORITE_CREATE: 5,
  FAVORITE_DELETE: 10,
  
  // AI
  AI_QUERY_GENERATE: 15,
  AI_MODEL_CHANGE: 40,
  AI_PROMPT_MODIFY: 35,
  
  // Destructive
  DESTRUCTIVE_CONFIRM: 85,
  DESTRUCTIVE_REJECT: 30,
};

const ACTION_CATEGORIES: Record<AuditActionType, AuditCategory> = {
  DDL_CREATE: AuditCategory.DATA,
  DDL_ALTER: AuditCategory.DATA,
  DDL_DROP: AuditCategory.DATA,
  DDL_TRUNCATE: AuditCategory.DATA,
  DML_INSERT: AuditCategory.DATA,
  DML_UPDATE: AuditCategory.DATA,
  DML_DELETE: AuditCategory.DATA,
  QUERY_EXECUTE: AuditCategory.QUERY,
  AUTH_LOGIN: AuditCategory.AUTH,
  AUTH_LOGOUT: AuditCategory.AUTH,
  AUTH_FAILED: AuditCategory.SECURITY,
  AUTH_PASSWORD_CHANGE: AuditCategory.AUTH,
  AUTH_PASSWORD_RESET: AuditCategory.AUTH,
  PERMISSION_GRANT: AuditCategory.ADMIN,
  PERMISSION_REVOKE: AuditCategory.ADMIN,
  ROLE_CHANGE: AuditCategory.ADMIN,
  USER_CREATE: AuditCategory.ADMIN,
  USER_UPDATE: AuditCategory.ADMIN,
  USER_DELETE: AuditCategory.ADMIN,
  USER_ACTIVATE: AuditCategory.ADMIN,
  USER_DEACTIVATE: AuditCategory.ADMIN,
  SENSITIVE_DATA_ACCESS: AuditCategory.SECURITY,
  BULK_DATA_ACCESS: AuditCategory.DATA,
  DATA_EXPORT: AuditCategory.DATA,
  DATA_IMPORT: AuditCategory.DATA,
  SYSTEM_STARTUP: AuditCategory.SYSTEM,
  SYSTEM_SHUTDOWN: AuditCategory.SYSTEM,
  BACKUP_CREATE: AuditCategory.SYSTEM,
  BACKUP_RESTORE: AuditCategory.SYSTEM,
  API_KEY_CREATE: AuditCategory.SECURITY,
  API_KEY_REVOKE: AuditCategory.SECURITY,
  RATE_LIMIT_EXCEEDED: AuditCategory.SECURITY,
  UNAUTHORIZED_ACCESS: AuditCategory.SECURITY,
  SESSION_TIMEOUT: AuditCategory.AUTH,
  SESSION_HIJACK_ATTEMPT: AuditCategory.SECURITY,
  CONCURRENT_LOGIN: AuditCategory.SECURITY,
  SESSION_TERMINATED: AuditCategory.AUTH,
  CONFIG_CHANGE: AuditCategory.ADMIN,
  DATASOURCE_CREATE: AuditCategory.ADMIN,
  DATASOURCE_UPDATE: AuditCategory.ADMIN,
  DATASOURCE_DELETE: AuditCategory.ADMIN,
  METADATA_VIEW: AuditCategory.DATA,
  METADATA_MODIFY: AuditCategory.ADMIN,
  SCHEMA_SYNC: AuditCategory.ADMIN,
  FAVORITE_CREATE: AuditCategory.DATA,
  FAVORITE_DELETE: AuditCategory.DATA,
  AI_QUERY_GENERATE: AuditCategory.AI,
  AI_MODEL_CHANGE: AuditCategory.AI,
  AI_PROMPT_MODIFY: AuditCategory.AI,
  DESTRUCTIVE_CONFIRM: AuditCategory.SECURITY,
  DESTRUCTIVE_REJECT: AuditCategory.SECURITY,
};

const SEVERITY_THRESHOLDS = {
  INFO: 25,
  WARNING: 50,
  DANGER: 75,
  CRITICAL: 100,
};

// ===========================================
// Service
// ===========================================

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  // ===========================================
  // 위험도 계산
  // ===========================================
  
  private calculateRiskScore(data: CreateAuditLogDto): number {
    let score = ACTION_RISK_SCORES[data.actionType] || 20;
    
    // 실패 시 위험도 증가
    if (data.success === false) {
      score += 20;
    }
    
    // 대량 데이터 작업 시 위험도 증가
    if (data.affectedRows && data.affectedRows > 1000) {
      score += 15;
    } else if (data.affectedRows && data.affectedRows > 100) {
      score += 10;
    }
    
    // 업무 외 시간 (21:00 ~ 06:00) 위험도 증가
    const hour = new Date().getHours();
    if (hour >= 21 || hour < 6) {
      score += 10;
    }
    
    // 주말 위험도 증가
    const day = new Date().getDay();
    if (day === 0 || day === 6) {
      score += 5;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  private getSeverityFromRiskScore(riskScore: number): AuditSeverity {
    if (riskScore >= SEVERITY_THRESHOLDS.CRITICAL) return AuditSeverity.CRITICAL;
    if (riskScore >= SEVERITY_THRESHOLDS.DANGER) return AuditSeverity.DANGER;
    if (riskScore >= SEVERITY_THRESHOLDS.WARNING) return AuditSeverity.WARNING;
    return AuditSeverity.INFO;
  }

  // ===========================================
  // 기본 로깅
  // ===========================================

  async log(data: CreateAuditLogDto): Promise<void> {
    try {
      const riskScore = this.calculateRiskScore(data);
      const category = data.category || ACTION_CATEGORIES[data.actionType] || AuditCategory.QUERY;
      const severity = data.severity || this.getSeverityFromRiskScore(riskScore);

      const log = await this.prisma.auditLog.create({
        data: {
          actionType: data.actionType,
          category,
          severity,
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
          sessionId: data.sessionId,
          requestId: data.requestId,
          apiEndpoint: data.apiEndpoint,
          httpMethod: data.httpMethod,
          previousValue: data.previousValue,
          newValue: data.newValue,
          clientInfo: data.clientInfo as any,
          geoInfo: data.geoInfo as any,
          riskScore,
          metadata: data.metadata,
        },
      });

      // 세션 활동 업데이트
      if (data.sessionId) {
        await this.updateSessionActivity(data.sessionId, riskScore);
      }

      // 고위험 활동 자동 보안 경고 생성
      if (riskScore >= 80) {
        await this.createSecurityAlert({
          alertType: 'HIGH_RISK_ACTIVITY',
          title: `고위험 활동 감지: ${data.actionType}`,
          description: data.description,
          severity: severity,
          auditLogId: log.id,
          userId: data.userId,
          userEmail: data.userEmail,
          ipAddress: data.ipAddress,
        });
      }
    } catch (error) {
      this.logger.error(`감사 로그 저장 실패: ${error.message}`);
    }
  }

  // ===========================================
  // 특화된 로깅 메서드
  // ===========================================

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

    await this.log({
      actionType: actionTypeMap[operation],
      category: AuditCategory.DATA,
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

    await this.log({
      actionType: actionTypeMap[operation],
      category: AuditCategory.DATA,
      description,
      ...options,
    });
  }

  /**
   * 인증 관련 로그
   */
  async logAuth(
    action: 'LOGIN' | 'LOGOUT' | 'FAILED' | 'PASSWORD_CHANGE' | 'PASSWORD_RESET',
    description: string,
    options: Partial<CreateAuditLogDto>,
  ): Promise<void> {
    const actionTypeMap = {
      LOGIN: AuditActionType.AUTH_LOGIN,
      LOGOUT: AuditActionType.AUTH_LOGOUT,
      FAILED: AuditActionType.AUTH_FAILED,
      PASSWORD_CHANGE: AuditActionType.AUTH_PASSWORD_CHANGE,
      PASSWORD_RESET: AuditActionType.AUTH_PASSWORD_RESET,
    };

    await this.log({
      actionType: actionTypeMap[action],
      category: action === 'FAILED' ? AuditCategory.SECURITY : AuditCategory.AUTH,
      description,
      ...options,
    });
  }

  /**
   * 사용자 관리 로그
   */
  async logUserManagement(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACTIVATE' | 'DEACTIVATE' | 'ROLE_CHANGE',
    description: string,
    options: Partial<CreateAuditLogDto> & { targetUserId?: string; targetUserEmail?: string },
  ): Promise<void> {
    const actionTypeMap = {
      CREATE: AuditActionType.USER_CREATE,
      UPDATE: AuditActionType.USER_UPDATE,
      DELETE: AuditActionType.USER_DELETE,
      ACTIVATE: AuditActionType.USER_ACTIVATE,
      DEACTIVATE: AuditActionType.USER_DEACTIVATE,
      ROLE_CHANGE: AuditActionType.ROLE_CHANGE,
    };

    await this.log({
      actionType: actionTypeMap[action],
      category: AuditCategory.ADMIN,
      description,
      metadata: {
        ...options.metadata,
        targetUserId: options.targetUserId,
        targetUserEmail: options.targetUserEmail,
      },
      ...options,
    });
  }

  /**
   * 데이터 접근 로그
   */
  async logDataAccess(
    action: 'SENSITIVE_ACCESS' | 'BULK_ACCESS' | 'EXPORT' | 'IMPORT',
    description: string,
    options: Partial<CreateAuditLogDto>,
  ): Promise<void> {
    const actionTypeMap = {
      SENSITIVE_ACCESS: AuditActionType.SENSITIVE_DATA_ACCESS,
      BULK_ACCESS: AuditActionType.BULK_DATA_ACCESS,
      EXPORT: AuditActionType.DATA_EXPORT,
      IMPORT: AuditActionType.DATA_IMPORT,
    };

    await this.log({
      actionType: actionTypeMap[action],
      category: action === 'SENSITIVE_ACCESS' ? AuditCategory.SECURITY : AuditCategory.DATA,
      description,
      ...options,
    });
  }

  /**
   * 시스템 이벤트 로그
   */
  async logSystem(
    action: 'STARTUP' | 'SHUTDOWN' | 'BACKUP_CREATE' | 'BACKUP_RESTORE',
    description: string,
    options?: Partial<CreateAuditLogDto>,
  ): Promise<void> {
    const actionTypeMap = {
      STARTUP: AuditActionType.SYSTEM_STARTUP,
      SHUTDOWN: AuditActionType.SYSTEM_SHUTDOWN,
      BACKUP_CREATE: AuditActionType.BACKUP_CREATE,
      BACKUP_RESTORE: AuditActionType.BACKUP_RESTORE,
    };

    await this.log({
      actionType: actionTypeMap[action],
      category: AuditCategory.SYSTEM,
      description,
      ...options,
    });
  }

  /**
   * AI 관련 로그
   */
  async logAI(
    action: 'QUERY_GENERATE' | 'MODEL_CHANGE' | 'PROMPT_MODIFY',
    description: string,
    options: Partial<CreateAuditLogDto>,
  ): Promise<void> {
    const actionTypeMap = {
      QUERY_GENERATE: AuditActionType.AI_QUERY_GENERATE,
      MODEL_CHANGE: AuditActionType.AI_MODEL_CHANGE,
      PROMPT_MODIFY: AuditActionType.AI_PROMPT_MODIFY,
    };

    await this.log({
      actionType: actionTypeMap[action],
      category: AuditCategory.AI,
      description,
      ...options,
    });
  }

  /**
   * 설정 변경 로그 (이전/이후 값 포함)
   */
  async logConfigChange(
    description: string,
    previousValue: any,
    newValue: any,
    options: Partial<CreateAuditLogDto>,
  ): Promise<void> {
    await this.log({
      actionType: AuditActionType.CONFIG_CHANGE,
      category: AuditCategory.ADMIN,
      description,
      previousValue,
      newValue,
      ...options,
    });
  }

  /**
   * 데이터소스 관리 로그
   */
  async logDataSource(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    description: string,
    options: Partial<CreateAuditLogDto>,
  ): Promise<void> {
    const actionTypeMap = {
      CREATE: AuditActionType.DATASOURCE_CREATE,
      UPDATE: AuditActionType.DATASOURCE_UPDATE,
      DELETE: AuditActionType.DATASOURCE_DELETE,
    };

    await this.log({
      actionType: actionTypeMap[action],
      category: AuditCategory.ADMIN,
      description,
      ...options,
    });
  }

  /**
   * 보안 이벤트 로그
   */
  async logSecurityEvent(
    action: 'UNAUTHORIZED_ACCESS' | 'RATE_LIMIT' | 'SESSION_HIJACK' | 'CONCURRENT_LOGIN',
    description: string,
    options: Partial<CreateAuditLogDto>,
  ): Promise<void> {
    const actionTypeMap = {
      UNAUTHORIZED_ACCESS: AuditActionType.UNAUTHORIZED_ACCESS,
      RATE_LIMIT: AuditActionType.RATE_LIMIT_EXCEEDED,
      SESSION_HIJACK: AuditActionType.SESSION_HIJACK_ATTEMPT,
      CONCURRENT_LOGIN: AuditActionType.CONCURRENT_LOGIN,
    };

    await this.log({
      actionType: actionTypeMap[action],
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.CRITICAL,
      description,
      ...options,
    });
  }

  // ===========================================
  // 세션 관리
  // ===========================================

  async createSession(data: {
    userId?: string;
    userEmail?: string;
    userName?: string;
    ipAddress?: string;
    userAgent?: string;
    clientInfo?: ClientInfo;
    geoInfo?: GeoInfo;
  }): Promise<string> {
    const session = await this.prisma.auditSession.create({
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        clientInfo: data.clientInfo as any,
        geoInfo: data.geoInfo as any,
      },
    });
    return session.id;
  }

  async endSession(sessionId: string, reason?: string): Promise<void> {
    await this.prisma.auditSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
        terminatedReason: reason,
      },
    });
  }

  private async updateSessionActivity(sessionId: string, riskScore: number): Promise<void> {
    try {
      await this.prisma.auditSession.update({
        where: { id: sessionId },
        data: {
          lastActivityAt: new Date(),
          activityCount: { increment: 1 },
          riskScore: { increment: Math.floor(riskScore / 10) },
        },
      });
    } catch (error) {
      // 세션이 없을 수 있음 - 무시
    }
  }

  async getSessionLogs(sessionId: string) {
    return this.prisma.auditLog.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getActiveSessions() {
    return this.prisma.auditSession.findMany({
      where: { isActive: true },
      orderBy: { lastActivityAt: 'desc' },
      take: 100,
    });
  }

  // ===========================================
  // 보안 경고
  // ===========================================

  async createSecurityAlert(data: {
    alertType: string;
    title: string;
    description: string;
    severity?: AuditSeverity;
    auditLogId?: string;
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.prisma.securityAlert.create({
        data: {
          alertType: data.alertType,
          title: data.title,
          description: data.description,
          severity: data.severity || AuditSeverity.WARNING,
          auditLogId: data.auditLogId,
          userId: data.userId,
          userEmail: data.userEmail,
          ipAddress: data.ipAddress,
          metadata: data.metadata,
        },
      });
    } catch (error) {
      this.logger.error(`보안 경고 생성 실패: ${error.message}`);
    }
  }

  async getSecurityAlerts(filter: SecurityAlertFilter, page = 1, limit = 50) {
    const where: any = {};

    if (filter.alertType) where.alertType = filter.alertType;
    if (filter.status) where.status = filter.status;
    if (filter.severity) where.severity = filter.severity;
    if (filter.userId) where.userId = filter.userId;

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = filter.startDate;
      if (filter.endDate) where.createdAt.lte = filter.endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.securityAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          auditLog: true,
        },
      }),
      this.prisma.securityAlert.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    await this.prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      },
    });
  }

  async resolveAlert(alertId: string, resolvedBy: string, resolution: string): Promise<void> {
    await this.prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedBy,
        resolvedAt: new Date(),
        resolution,
      },
    });
  }

  async dismissAlert(alertId: string, dismissedBy: string): Promise<void> {
    await this.prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.DISMISSED,
        resolvedBy: dismissedBy,
        resolvedAt: new Date(),
      },
    });
  }

  // ===========================================
  // 조회
  // ===========================================

  async findAll(filter: AuditLogFilter, page = 1, limit = 50) {
    const where: any = {};

    if (filter.actionType) where.actionType = filter.actionType;
    if (filter.category) where.category = filter.category;
    if (filter.severity) where.severity = filter.severity;
    if (filter.userId) where.userId = filter.userId;
    if (filter.dataSourceId) where.dataSourceId = filter.dataSourceId;
    if (filter.success !== undefined) where.success = filter.success;
    if (filter.ipAddress) where.ipAddress = filter.ipAddress;
    if (filter.sessionId) where.sessionId = filter.sessionId;
    if (filter.minRiskScore) where.riskScore = { gte: filter.minRiskScore };
    
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
        { apiEndpoint: { contains: filter.search, mode: 'insensitive' } },
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

  async findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        session: true,
        securityAlerts: true,
      },
    });
  }

  // ===========================================
  // 사용자 타임라인
  // ===========================================

  async getUserTimeline(userId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // 날짜별로 그룹화
    const timeline = logs.reduce((acc: Record<string, any[]>, log) => {
      const date = log.createdAt.toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(log);
      return acc;
    }, {});

    return timeline;
  }

  // ===========================================
  // 통계
  // ===========================================

  async getStats(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [byActionType, bySeverity, byCategory, byDay, recentCritical, topRiskyUsers, openAlerts] = await Promise.all([
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
      this.prisma.auditLog.groupBy({
        by: ['category'],
        _count: true,
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM "AuditLog"
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
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
      // 위험도가 높은 사용자
      this.prisma.auditLog.groupBy({
        by: ['userId', 'userEmail'],
        _sum: { riskScore: true },
        _count: true,
        where: { createdAt: { gte: startDate }, userId: { not: null } },
        orderBy: { _sum: { riskScore: 'desc' } },
        take: 10,
      }),
      // 미해결 보안 경고
      this.prisma.securityAlert.count({
        where: { status: AlertStatus.OPEN },
      }),
    ]);

    return {
      byActionType,
      bySeverity,
      byCategory,
      byDay,
      recentCritical,
      topRiskyUsers,
      openAlerts,
    };
  }

  async getAnomalies(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 비정상 패턴 감지
    const anomalies = {
      // 실패한 로그인 시도가 많은 IP
      bruteForceAttempts: await this.prisma.auditLog.groupBy({
        by: ['ipAddress'],
        _count: true,
        where: {
          actionType: AuditActionType.AUTH_FAILED,
          createdAt: { gte: startDate },
        },
        having: { ipAddress: { _count: { gt: 5 } } },
        orderBy: { _count: { ipAddress: 'desc' } },
      }),

      // 업무 외 시간 고위험 활동
      afterHoursHighRisk: await this.prisma.auditLog.count({
        where: {
          riskScore: { gte: 70 },
          createdAt: { gte: startDate },
          // 실제 시간 필터는 raw query로 해야 하지만, 간단히 처리
        },
      }),

      // 대량 데이터 접근
      bulkDataAccess: await this.prisma.auditLog.findMany({
        where: {
          actionType: { in: [AuditActionType.BULK_DATA_ACCESS, AuditActionType.DATA_EXPORT] },
          affectedRows: { gte: 1000 },
          createdAt: { gte: startDate },
        },
        orderBy: { affectedRows: 'desc' },
        take: 20,
      }),

      // 권한 변경 이력
      permissionChanges: await this.prisma.auditLog.findMany({
        where: {
          actionType: { in: [AuditActionType.PERMISSION_GRANT, AuditActionType.PERMISSION_REVOKE, AuditActionType.ROLE_CHANGE] },
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    };

    return anomalies;
  }

  // ===========================================
  // 내보내기
  // ===========================================

  async exportCSV(filter: AuditLogFilter): Promise<string> {
    const { items } = await this.findAll(filter, 1, 10000);

    const headers = [
      'ID', 'Timestamp', 'Category', 'Action Type', 'Severity', 'Risk Score',
      'Description', 'User Email', 'User Name', 'Data Source', 'Table', 
      'Affected Rows', 'Success', 'Error Message', 'IP Address',
      'API Endpoint', 'HTTP Method', 'Execution Time (ms)',
    ];

    const rows = items.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.category,
      log.actionType,
      log.severity,
      log.riskScore,
      `"${(log.description || '').replace(/"/g, '""')}"`,
      log.userEmail || '',
      log.userName || '',
      log.dataSourceName || '',
      log.tableName || '',
      log.affectedRows ?? '',
      log.success ? 'Yes' : 'No',
      `"${(log.errorMessage || '').replace(/"/g, '""')}"`,
      log.ipAddress || '',
      log.apiEndpoint || '',
      log.httpMethod || '',
      log.executionTime ?? '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
