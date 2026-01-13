import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface QueryHistoryFilter {
  userId?: string;
  dataSourceId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  riskLevel?: string;
}

@Injectable()
export class QueryService {
  constructor(private prisma: PrismaService) {}

  async getHistory(filter: QueryHistoryFilter) {
    const {
      userId,
      dataSourceId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      riskLevel,
    } = filter;

    const where: any = {};
    if (userId) where.userId = userId;
    if (dataSourceId) where.dataSourceId = dataSourceId;
    if (status) where.status = status;
    if (riskLevel) where.riskLevel = riskLevel;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.queryHistory.findMany({
        where,
        include: {
          dataSource: { select: { name: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.queryHistory.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getQueryById(id: string) {
    const query = await this.prisma.queryHistory.findUnique({
      where: { id },
      include: {
        dataSource: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!query) {
      throw new NotFoundException('쿼리를 찾을 수 없습니다.');
    }

    return query;
  }

  // 즐겨찾기
  async getFavorites(userId: string) {
    return this.prisma.favoriteQuery.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addFavorite(
    userId: string,
    data: { name: string; naturalQuery: string; sqlQuery: string; dataSourceId?: string },
  ) {
    const { name, naturalQuery, sqlQuery, dataSourceId } = data;
    return this.prisma.favoriteQuery.create({
      data: {
        userId,
        name,
        naturalQuery,
        sqlQuery,
        dataSourceId,
      },
    });
  }

  async removeFavorite(userId: string, favoriteId: string) {
    const favorite = await this.prisma.favoriteQuery.findFirst({
      where: { id: favoriteId, userId },
    });

    if (!favorite) {
      throw new NotFoundException('즐겨찾기를 찾을 수 없습니다.');
    }

    return this.prisma.favoriteQuery.delete({
      where: { id: favoriteId },
    });
  }

  // 통계
  async getStats(userId?: string) {
    const where = userId ? { userId } : {};

    const [total, success, failed, blocked] = await Promise.all([
      this.prisma.queryHistory.count({ where }),
      this.prisma.queryHistory.count({ where: { ...where, status: 'SUCCESS' } }),
      this.prisma.queryHistory.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.queryHistory.count({ where: { ...where, status: 'BLOCKED' } }),
    ]);

    const avgExecutionTime = await this.prisma.queryHistory.aggregate({
      where: { ...where, status: 'SUCCESS' },
      _avg: { executionTime: true },
    });

    // Risk Stats
    const riskStats = await this.prisma.queryHistory.groupBy({
      by: ['riskLevel'],
      where,
      _count: {
        _all: true,
      },
    });

    return {
      total,
      success,
      failed,
      blocked,
      successRate: total > 0 ? ((success / total) * 100).toFixed(1) : '0',
      avgExecutionTime: avgExecutionTime._avg.executionTime || 0,
      riskDistribution: riskStats.map(r => ({ level: r.riskLevel, count: r._count._all })),
    };
  }
  // Collaboration - Comments
  async addComment(userId: string, queryId: string, content: string) {
    return this.prisma['queryComment'].create({
      data: {
        queryHistoryId: queryId,
        userId,
        content,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getComments(queryId: string) {
    return this.prisma['queryComment'].findMany({
      where: { queryHistoryId: queryId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // Collaboration - Sharing
  async shareQuery(
    userId: string,
    queryId: string,
    options: { sharedToUserId?: string; sharedToTeam?: string; isPublic?: boolean }
  ) {
    return this.prisma['queryShare'].create({
      data: {
        queryHistoryId: queryId,
        sharedByUserId: userId,
        ...options,
      },
    });
  }

  async getShares(queryId: string) {
    return this.prisma['queryShare'].findMany({
      where: { queryHistoryId: queryId },
      include: {
        sharedByUser: { select: { id: true, name: true } },
      },
    });
  }
  // Feedback
  async addFeedback(userId: string, queryId: string, feedback: 'POSITIVE' | 'NEGATIVE', note?: string) {
    return this.prisma.queryHistory.update({
      where: { id: queryId },
      data: {
        feedback,
        feedbackNote: note,
      },
    });
  }
}
