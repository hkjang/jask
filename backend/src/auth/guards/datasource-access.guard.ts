import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DATASOURCE_ROLES_KEY } from '../decorators/datasource-roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard to check data source-level access permissions.
 * Requires the route to have a :id or :dataSourceId parameter.
 * 
 * Logic:
 * 1. If user has system role ADMIN, access is always granted
 * 2. Otherwise, check DataSourceAccess table for user's role on this data source
 * 3. Compare user's data source role against required roles
 * 
 * Role hierarchy: ADMIN > EDITOR > VIEWER
 */
@Injectable()
export class DataSourceAccessGuard implements CanActivate {
  private static readonly ROLE_HIERARCHY: Record<string, number> = {
    'VIEWER': 1,
    'EDITOR': 2,
    'ADMIN': 3,
  };

  constructor(
    private reflector: Reflector,
    @Inject(forwardRef(() => PrismaService))
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(DATASOURCE_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No role requirement means public access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    // System ADMIN has access to all data sources
    if (user.role === 'ADMIN') {
      return true;
    }

    // Get data source ID from route params
    const dataSourceId = request.params.id || request.params.dataSourceId || request.body?.dataSourceId;

    if (!dataSourceId) {
      throw new ForbiddenException('데이터소스 ID가 필요합니다.');
    }

    // Check user's access to this data source
    const access = await this.prisma.dataSourceAccess.findUnique({
      where: {
        userId_dataSourceId: {
          userId: user.sub || user.id,
          dataSourceId: dataSourceId,
        },
      },
    });

    if (!access) {
      throw new ForbiddenException('해당 데이터소스에 대한 접근 권한이 없습니다.');
    }

    // Check if access has expired
    if (access.expiresAt && new Date(access.expiresAt) < new Date()) {
      throw new ForbiddenException('데이터소스 접근 권한이 만료되었습니다.');
    }

    // Check role hierarchy
    const userRoleLevel = DataSourceAccessGuard.ROLE_HIERARCHY[access.role] || 0;
    const minRequiredLevel = Math.min(
      ...requiredRoles.map(r => DataSourceAccessGuard.ROLE_HIERARCHY[r] || 0)
    );

    if (userRoleLevel < minRequiredLevel) {
      throw new ForbiddenException('해당 작업에 필요한 권한이 부족합니다.');
    }

    // Attach access info to request for later use
    request.dataSourceAccess = access;

    return true;
  }
}
