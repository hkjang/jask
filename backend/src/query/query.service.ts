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

  // ===========================================
  // 즐겨찾기
  // ===========================================
  
  async getFavorites(userId: string, options?: { 
    folderId?: string; 
    tag?: string; 
    dataSourceId?: string;
    sortBy?: 'createdAt' | 'useCount' | 'name' | 'displayOrder';
    sortOrder?: 'asc' | 'desc';
  }) {
    const { folderId, tag, dataSourceId, sortBy = 'createdAt', sortOrder = 'desc' } = options || {};
    
    const where: any = { userId };
    if (folderId) where.folderId = folderId;
    if (dataSourceId) where.dataSourceId = dataSourceId;
    if (tag) where.tags = { has: tag };
    
    return this.prisma.favoriteQuery.findMany({
      where,
      include: {
        folder: { select: { id: true, name: true, color: true, icon: true } },
      },
      orderBy: { [sortBy]: sortOrder },
    });
  }


  async addFavorite(
    userId: string,
    data: { 
      name: string; 
      naturalQuery: string; 
      sqlQuery: string; 
      dataSourceId?: string;
      folderId?: string;
      tags?: string[];
      description?: string;
    },
  ) {
    const { name, naturalQuery, sqlQuery, dataSourceId, folderId, tags, description } = data;
    return this.prisma.favoriteQuery.create({
      data: {
        userId,
        name,
        naturalQuery,
        sqlQuery,
        dataSourceId,
        folderId,
        tags: tags || [],
        description,
      },
      include: {
        folder: { select: { id: true, name: true, color: true, icon: true } },
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

  async updateFavorite(
    userId: string,
    favoriteId: string,
    data: { 
      name?: string; 
      folderId?: string | null;
      tags?: string[];
      description?: string;
      displayOrder?: number;
    },
  ) {
    const favorite = await this.prisma.favoriteQuery.findFirst({
      where: { id: favoriteId, userId },
    });

    if (!favorite) {
      throw new NotFoundException('즐겨찾기를 찾을 수 없습니다.');
    }

    return this.prisma.favoriteQuery.update({
      where: { id: favoriteId },
      data,
      include: {
        folder: { select: { id: true, name: true, color: true, icon: true } },
      },
    });
  }

  async incrementFavoriteUseCount(userId: string, favoriteId: string) {
    const favorite = await this.prisma.favoriteQuery.findFirst({
      where: { id: favoriteId, userId },
    });

    if (!favorite) {
      throw new NotFoundException('즐겨찾기를 찾을 수 없습니다.');
    }

    return this.prisma.favoriteQuery.update({
      where: { id: favoriteId },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  async reorderFavorites(userId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.favoriteQuery.updateMany({
        where: { id, userId },
        data: { displayOrder: index },
      }),
    );
    await this.prisma.$transaction(updates);
    return { success: true };
  }

  async getFavoriteStats(userId: string) {
    const [total, withFolder, topTags, topUsed] = await Promise.all([
      this.prisma.favoriteQuery.count({ where: { userId } }),
      this.prisma.favoriteQuery.count({ where: { userId, folderId: { not: null } } }),
      this.prisma.favoriteQuery.findMany({
        where: { userId, tags: { isEmpty: false } },
        select: { tags: true },
      }),
      this.prisma.favoriteQuery.findMany({
        where: { userId },
        orderBy: { useCount: 'desc' },
        take: 5,
        select: { id: true, name: true, useCount: true },
      }),
    ]);

    // Count tags
    const tagCounts: Record<string, number> = {};
    topTags.forEach((fav) => {
      fav.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      total,
      withFolder,
      topTags: sortedTags,
      topUsed,
    };
  }

  // ===========================================
  // 즐겨찾기 폴더
  // ===========================================
  
  async getFavoriteFolders(userId: string) {
    return this.prisma.favoriteFolder.findMany({
      where: { userId },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { favorites: true } },
      },
    });
  }

  async createFavoriteFolder(
    userId: string,
    data: { name: string; color?: string; icon?: string },
  ) {
    const { name, color, icon } = data;
    
    // Get max display order
    const maxOrder = await this.prisma.favoriteFolder.aggregate({
      where: { userId },
      _max: { displayOrder: true },
    });
    
    return this.prisma.favoriteFolder.create({
      data: {
        userId,
        name,
        color,
        icon,
        displayOrder: (maxOrder._max.displayOrder || 0) + 1,
      },
      include: {
        _count: { select: { favorites: true } },
      },
    });
  }

  async updateFavoriteFolder(
    userId: string,
    folderId: string,
    data: { name?: string; color?: string; icon?: string; displayOrder?: number },
  ) {
    const folder = await this.prisma.favoriteFolder.findFirst({
      where: { id: folderId, userId },
    });

    if (!folder) {
      throw new NotFoundException('폴더를 찾을 수 없습니다.');
    }

    return this.prisma.favoriteFolder.update({
      where: { id: folderId },
      data,
      include: {
        _count: { select: { favorites: true } },
      },
    });
  }

  async deleteFavoriteFolder(userId: string, folderId: string) {
    const folder = await this.prisma.favoriteFolder.findFirst({
      where: { id: folderId, userId },
    });

    if (!folder) {
      throw new NotFoundException('폴더를 찾을 수 없습니다.');
    }

    // Favorites in this folder will have folderId set to null (onDelete: SetNull)
    return this.prisma.favoriteFolder.delete({
      where: { id: folderId },
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
