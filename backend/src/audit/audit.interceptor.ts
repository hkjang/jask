import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditActionType, AuditCategory } from '@prisma/client';

// 자동 로깅에서 제외할 엔드포인트
const EXCLUDED_ENDPOINTS = [
  '/api/health',
  '/api/admin/audit',  // 감사 로그 조회는 제외
  '/api/auth/me',
];

// 민감한 엔드포인트 (더 상세한 로깅)
const SENSITIVE_ENDPOINTS = [
  { pattern: /\/api\/admin\/users/, action: AuditActionType.USER_UPDATE },
  { pattern: /\/api\/datasources/, action: AuditActionType.DATASOURCE_UPDATE },
  { pattern: /\/api\/admin\/settings/, action: AuditActionType.CONFIG_CHANGE },
  { pattern: /\/api\/admin\/llm-providers/, action: AuditActionType.AI_MODEL_CHANGE },
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers, user, body } = request;

    // 제외 엔드포인트 체크
    if (EXCLUDED_ENDPOINTS.some(ep => url.startsWith(ep))) {
      return next.handle();
    }

    // GET 요청은 기본적으로 제외 (민감한 데이터 접근 제외)
    if (method === 'GET' && !this.isSensitiveDataAccess(url)) {
      return next.handle();
    }

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    return next.handle().pipe(
      tap(async (response) => {
        const executionTime = Date.now() - startTime;
        await this.logRequest(request, response, executionTime, requestId, true);
      }),
      catchError(async (error) => {
        const executionTime = Date.now() - startTime;
        await this.logRequest(request, null, executionTime, requestId, false, error.message);
        throw error;
      }),
    );
  }

  private async logRequest(
    request: any,
    response: any,
    executionTime: number,
    requestId: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    const { method, url, ip, headers, user, body } = request;

    // 액션 타입 결정
    const actionType = this.determineActionType(method, url);
    const category = this.determineCategory(url);

    // 설명 생성
    const description = this.generateDescription(method, url, user, body);

    // 클라이언트 정보 파싱
    const clientInfo = this.parseClientInfo(headers['user-agent']);

    try {
      await this.auditService.log({
        actionType,
        category,
        description,
        userId: user?.id,
        userEmail: user?.email,
        userName: user?.name,
        ipAddress: this.getClientIp(request),
        userAgent: headers['user-agent'],
        apiEndpoint: url.split('?')[0],  // 쿼리 파라미터 제외
        httpMethod: method,
        requestId,
        executionTime,
        success,
        errorMessage,
        clientInfo,
        metadata: {
          queryParams: request.query,
          // 민감한 필드는 마스킹
          body: this.maskSensitiveData(body),
        },
      });
    } catch (error) {
      this.logger.error(`자동 감사 로깅 실패: ${error.message}`);
    }
  }

  private determineActionType(method: string, url: string): AuditActionType {
    // 특정 엔드포인트 매칭
    for (const endpoint of SENSITIVE_ENDPOINTS) {
      if (endpoint.pattern.test(url)) {
        return endpoint.action;
      }
    }

    // HTTP 메서드 기반 기본 액션 타입
    switch (method) {
      case 'POST':
        if (url.includes('/login')) return AuditActionType.AUTH_LOGIN;
        if (url.includes('/logout')) return AuditActionType.AUTH_LOGOUT;
        if (url.includes('/execute') || url.includes('/query')) return AuditActionType.QUERY_EXECUTE;
        return AuditActionType.DML_INSERT;
      case 'PUT':
      case 'PATCH':
        return AuditActionType.DML_UPDATE;
      case 'DELETE':
        return AuditActionType.DML_DELETE;
      default:
        return AuditActionType.QUERY_EXECUTE;
    }
  }

  private determineCategory(url: string): AuditCategory {
    if (url.includes('/auth') || url.includes('/login') || url.includes('/logout')) {
      return AuditCategory.AUTH;
    }
    if (url.includes('/admin')) {
      return AuditCategory.ADMIN;
    }
    if (url.includes('/ai') || url.includes('/chat') || url.includes('/generate')) {
      return AuditCategory.AI;
    }
    if (url.includes('/datasources') || url.includes('/metadata')) {
      return AuditCategory.DATA;
    }
    if (url.includes('/query') || url.includes('/execute')) {
      return AuditCategory.QUERY;
    }
    return AuditCategory.SYSTEM;
  }

  private generateDescription(method: string, url: string, user: any, body: any): string {
    const action = this.getActionName(method);
    const resource = this.extractResource(url);
    const userName = user?.name || user?.email || 'Unknown';
    
    return `${userName}이(가) ${resource}에 대해 ${action} 작업 수행`;
  }

  private getActionName(method: string): string {
    switch (method) {
      case 'GET': return '조회';
      case 'POST': return '생성';
      case 'PUT':
      case 'PATCH': return '수정';
      case 'DELETE': return '삭제';
      default: return method;
    }
  }

  private extractResource(url: string): string {
    // URL에서 리소스 이름 추출
    const parts = url.split('/').filter(Boolean);
    const resourcePart = parts.find(p => !p.match(/^[0-9a-f-]{36}$/i) && p !== 'api');
    return resourcePart || 'resource';
  }

  private isSensitiveDataAccess(url: string): boolean {
    const sensitivePatterns = [
      /\/api\/admin\/users\/.+/,  // 특정 사용자 정보 조회
      /\/api\/datasources\/.+\/data/,  // 데이터 조회
      /\/api\/export/,
    ];
    return sensitivePatterns.some(p => p.test(url));
  }

  private parseClientInfo(userAgent?: string): any {
    if (!userAgent) return null;

    // 간단한 UA 파싱 (실제 프로덕션에서는 ua-parser-js 같은 라이브러리 사용)
    const info: any = {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Desktop',
      isMobile: false,
    };

    // Browser detection
    if (userAgent.includes('Chrome')) info.browser = 'Chrome';
    else if (userAgent.includes('Firefox')) info.browser = 'Firefox';
    else if (userAgent.includes('Safari')) info.browser = 'Safari';
    else if (userAgent.includes('Edge')) info.browser = 'Edge';

    // OS detection
    if (userAgent.includes('Windows')) info.os = 'Windows';
    else if (userAgent.includes('Mac')) info.os = 'macOS';
    else if (userAgent.includes('Linux')) info.os = 'Linux';
    else if (userAgent.includes('Android')) {
      info.os = 'Android';
      info.isMobile = true;
      info.device = 'Mobile';
    }
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      info.os = 'iOS';
      info.isMobile = userAgent.includes('iPhone');
      info.device = userAgent.includes('iPad') ? 'Tablet' : 'Mobile';
    }

    return info;
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.ip ||
      request.connection?.remoteAddress ||
      'unknown'
    );
  }

  private maskSensitiveData(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'credential'];
    const masked: any = {};

    for (const [key, value] of Object.entries(body)) {
      if (sensitiveFields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
