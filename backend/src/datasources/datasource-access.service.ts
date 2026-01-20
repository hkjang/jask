import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DataSourceRole } from '@prisma/client';

export interface GrantAccessDto {
  userId: string;
  dataSourceId: string;
  role: DataSourceRole;
  note?: string;
  expiresAt?: Date;
}

export interface AuditContext {
  userId?: string;
  userEmail?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DataSourceAccessService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Grant access to a data source for a user
   */
  async grantAccess(
    dto: GrantAccessDto,
    grantedBy: { id: string; name: string },
    auditContext?: AuditContext,
  ) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // Verify data source exists
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dto.dataSourceId },
    });
    if (!dataSource) {
      throw new NotFoundException('데이터소스를 찾을 수 없습니다.');
    }

    // Check for existing access
    const existingAccess = await this.prisma.dataSourceAccess.findUnique({
      where: {
        userId_dataSourceId: {
          userId: dto.userId,
          dataSourceId: dto.dataSourceId,
        },
      },
    });

    if (existingAccess) {
      throw new ConflictException('해당 사용자에게 이미 접근 권한이 부여되어 있습니다. 수정하려면 updateAccess를 사용하세요.');
    }

    const access = await this.prisma.dataSourceAccess.create({
      data: {
        userId: dto.userId,
        dataSourceId: dto.dataSourceId,
        role: dto.role,
        grantedById: grantedBy.id,
        grantedByName: grantedBy.name,
        note: dto.note,
        expiresAt: dto.expiresAt,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        dataSource: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await this.auditService.log({
      actionType: 'PERMISSION_GRANT',
      category: 'ADMIN',
      severity: 'INFO',
      description: `데이터소스 접근 권한 부여: ${user.email} -> ${dataSource.name} (${dto.role})`,
      ...auditContext,
      dataSourceId: dto.dataSourceId,
      dataSourceName: dataSource.name,
      metadata: {
        targetUserId: dto.userId,
        targetUserEmail: user.email,
        role: dto.role,
        expiresAt: dto.expiresAt,
      },
    });

    return access;
  }

  /**
   * Update existing access role
   */
  async updateAccess(
    userId: string,
    dataSourceId: string,
    newRole: DataSourceRole,
    auditContext?: AuditContext,
  ) {
    const existingAccess = await this.prisma.dataSourceAccess.findUnique({
      where: {
        userId_dataSourceId: { userId, dataSourceId },
      },
      include: {
        user: { select: { email: true, name: true } },
        dataSource: { select: { name: true } },
      },
    });

    if (!existingAccess) {
      throw new NotFoundException('접근 권한을 찾을 수 없습니다.');
    }

    const previousRole = existingAccess.role;

    const updated = await this.prisma.dataSourceAccess.update({
      where: {
        userId_dataSourceId: { userId, dataSourceId },
      },
      data: {
        role: newRole,
        updatedAt: new Date(),
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        dataSource: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await this.auditService.log({
      actionType: 'ROLE_CHANGE',
      category: 'ADMIN',
      severity: 'INFO',
      description: `데이터소스 접근 권한 변경: ${existingAccess.user.email} (${previousRole} -> ${newRole})`,
      ...auditContext,
      dataSourceId,
      dataSourceName: existingAccess.dataSource.name,
      previousValue: { role: previousRole },
      newValue: { role: newRole },
      metadata: {
        targetUserId: userId,
        targetUserEmail: existingAccess.user.email,
      },
    });

    return updated;
  }

  /**
   * Revoke access to a data source
   */
  async revokeAccess(
    userId: string,
    dataSourceId: string,
    auditContext?: AuditContext,
  ) {
    const existingAccess = await this.prisma.dataSourceAccess.findUnique({
      where: {
        userId_dataSourceId: { userId, dataSourceId },
      },
      include: {
        user: { select: { email: true, name: true } },
        dataSource: { select: { name: true } },
      },
    });

    if (!existingAccess) {
      throw new NotFoundException('접근 권한을 찾을 수 없습니다.');
    }

    await this.prisma.dataSourceAccess.delete({
      where: {
        userId_dataSourceId: { userId, dataSourceId },
      },
    });

    // Audit log
    await this.auditService.log({
      actionType: 'PERMISSION_REVOKE',
      category: 'ADMIN',
      severity: 'WARNING',
      description: `데이터소스 접근 권한 회수: ${existingAccess.user.email} <- ${existingAccess.dataSource.name}`,
      ...auditContext,
      dataSourceId,
      dataSourceName: existingAccess.dataSource.name,
      previousValue: { role: existingAccess.role },
      metadata: {
        targetUserId: userId,
        targetUserEmail: existingAccess.user.email,
      },
    });

    return { success: true };
  }

  /**
   * Get all users with access to a specific data source
   */
  async getDataSourceUsers(dataSourceId: string) {
    return this.prisma.dataSourceAccess.findMany({
      where: { dataSourceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            department: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { role: 'desc' },
        { grantedAt: 'desc' },
      ],
    });
  }

  /**
   * Get all data sources a user has access to
   */
  async getUserDataSources(userId: string) {
    return this.prisma.dataSourceAccess.findMany({
      where: { 
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        dataSource: {
          select: {
            id: true,
            name: true,
            type: true,
            database: true,
            environment: true,
            isActive: true,
            healthStatus: true,
          },
        },
      },
      orderBy: { role: 'desc' },
    });
  }

  /**
   * Check if user has required access level
   * Returns true if user has access, false otherwise
   */
  async checkAccess(
    userId: string,
    dataSourceId: string,
    requiredRole: DataSourceRole = 'VIEWER',
  ): Promise<boolean> {
    // First check if user is system ADMIN
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === 'ADMIN') {
      return true;
    }

    const access = await this.prisma.dataSourceAccess.findUnique({
      where: {
        userId_dataSourceId: { userId, dataSourceId },
      },
    });

    if (!access) {
      return false;
    }

    // Check expiration
    if (access.expiresAt && new Date(access.expiresAt) < new Date()) {
      return false;
    }

    // Check role hierarchy
    const roleHierarchy: Record<DataSourceRole, number> = {
      'VIEWER': 1,
      'EDITOR': 2,
      'ADMIN': 3,
    };

    return roleHierarchy[access.role] >= roleHierarchy[requiredRole];
  }

  /**
   * Bulk grant access to multiple users
   */
  async bulkGrantAccess(
    dataSourceId: string,
    userIds: string[],
    role: DataSourceRole,
    grantedBy: { id: string; name: string },
    auditContext?: AuditContext,
  ) {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
    });
    if (!dataSource) {
      throw new NotFoundException('데이터소스를 찾을 수 없습니다.');
    }

    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const access = await this.grantAccess(
          { userId, dataSourceId, role },
          grantedBy,
          auditContext,
        );
        results.push(access);
      } catch (error) {
        errors.push({ userId, error: error.message });
      }
    }

    return { success: results, errors };
  }

  /**
   * Bulk revoke access from multiple users
   */
  async bulkRevokeAccess(
    dataSourceId: string,
    userIds: string[],
    auditContext?: AuditContext,
  ) {
    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        await this.revokeAccess(userId, dataSourceId, auditContext);
        results.push({ userId, success: true });
      } catch (error) {
        errors.push({ userId, error: error.message });
      }
    }

    return { success: results, errors };
  }

  /**
   * Get access statistics for admin dashboard
   */
  async getAccessStats() {
    const [
      totalAccess,
      byRole,
      byDataSource,
      expiringAccess,
    ] = await Promise.all([
      this.prisma.dataSourceAccess.count(),
      this.prisma.dataSourceAccess.groupBy({
        by: ['role'],
        _count: true,
      }),
      this.prisma.dataSourceAccess.groupBy({
        by: ['dataSourceId'],
        _count: true,
      }),
      this.prisma.dataSourceAccess.count({
        where: {
          expiresAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          },
        },
      }),
    ]);

    return {
      total: totalAccess,
      byRole: byRole.reduce((acc, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byDataSource,
      expiringSoon: expiringAccess,
    };
  }

  /**
   * Clean up expired access records
   */
  async cleanupExpiredAccess() {
    const expired = await this.prisma.dataSourceAccess.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
      include: {
        user: { select: { email: true } },
        dataSource: { select: { name: true } },
      },
    });

    if (expired.length > 0) {
      await this.prisma.dataSourceAccess.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      // Log cleanup
      for (const access of expired) {
        await this.auditService.log({
          actionType: 'PERMISSION_REVOKE',
          category: 'SYSTEM',
          severity: 'INFO',
          description: `만료된 접근 권한 자동 정리: ${access.user.email} <- ${access.dataSource.name}`,
          dataSourceId: access.dataSourceId,
          dataSourceName: access.dataSource.name,
          metadata: {
            reason: 'expired',
            expiredAt: access.expiresAt,
          },
        });
      }
    }

    return { cleaned: expired.length };
  }
}
