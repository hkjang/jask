import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LLMService } from '../llm/llm.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
  ) {}

  // LLM 프로바이더 관리
  async getLLMProviders() {
    return this.prisma.lLMProvider.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLLMProvider(data: {
    name: string;
    baseUrl: string;
    model: string;
    apiKey?: string;
    isDefault?: boolean;
    config?: any;
  }) {
    if (data.isDefault) {
      await this.prisma.lLMProvider.updateMany({
        data: { isDefault: false },
      });
    }

    return this.prisma.lLMProvider.create({ data });
  }

  async updateLLMProvider(id: string, data: Partial<{
    baseUrl: string;
    model: string;
    apiKey: string;
    isActive: boolean;
    isDefault: boolean;
    config: any;
  }>) {
    if (data.isDefault) {
      await this.prisma.lLMProvider.updateMany({
        data: { isDefault: false },
      });
    }

    return this.prisma.lLMProvider.update({
      where: { id },
      data,
    });
  }

  async deleteLLMProvider(id: string) {
    return this.prisma.lLMProvider.delete({ where: { id } });
  }

  // 시스템 설정
  async getSettings() {
    const settings = await this.prisma.systemSettings.findMany();
    return settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, any>);
  }

  async updateSetting(key: string, value: any, description?: string) {
    return this.prisma.systemSettings.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });
  }

  // 사용자 관리
  async getUsers(page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: { select: { queries: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return { items, pagination: { page, limit, total } };
  }

  async updateUserRole(userId: string, role: 'USER' | 'ADMIN') {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async toggleUserActive(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user?.isActive },
    });
  }

  // 대시보드 통계
  async getDashboardStats() {
    const [
      totalUsers,
      totalQueries,
      totalDataSources,
      recentQueries,
      queryStats,
      riskStats,
      feedbackStats,
      avgTrustScore
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.queryHistory.count(),
      this.prisma.dataSource.count({ where: { isActive: true } }),
      this.prisma.queryHistory.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true } },
          dataSource: { select: { name: true } },
        },
      }),
      this.prisma.queryHistory.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Risk Distribution
      this.prisma.queryHistory.groupBy({
        by: ['riskLevel'],
        _count: true,
      }),
      // Feedback Stats
      this.prisma.queryHistory.groupBy({
        by: ['feedback'],
        _count: true,
      }),
      // Avg Trust Score
      this.prisma.queryHistory.aggregate({
         _avg: { trustScore: true },
         where: { status: 'SUCCESS' }
      })
    ]);

    return {
      totalUsers,
      totalQueries,
      totalDataSources,
      recentQueries,
      queryStats: queryStats.reduce((acc, s) => {
        acc[s.status] = s._count;
        return acc;
      }, {} as Record<string, number>),
      riskStats: riskStats.reduce((acc, s) => { 
        acc[s.riskLevel] = s._count;
        return acc;
      }, {} as Record<string, number>),
      feedbackStats: feedbackStats.reduce((acc, s) => { 
        if (s.feedback) acc[s.feedback] = s._count;
        return acc;
      }, {} as Record<string, number>),
      avgTrustScore: avgTrustScore._avg.trustScore || 0, 
    };
  }

  // 샘플 쿼리 관리
  async getSampleQueries(dataSourceId?: string) {
    return this.prisma.sampleQuery.findMany({
      where: dataSourceId ? { dataSourceId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSampleQuery(data: {
    dataSourceId: string;
    naturalQuery: string;
    sqlQuery: string;
    description?: string;
    tags?: string[];
  }) {
    // 1. Create Basic Record
    const sample = await this.prisma.sampleQuery.create({ data });

    // 2. Generate and Update Embedding
    try {
      const embeddingText = `Question: ${data.naturalQuery}\nSQL: ${data.sqlQuery}\nDescription: ${data.description || ''}`;
      const embedding = await this.llmService.generateEmbedding(embeddingText);
      const vectorString = `[${embedding.join(',')}]`;

      await this.prisma.$executeRaw`
        UPDATE "SampleQuery"
        SET "embedding" = ${vectorString}::vector
        WHERE "id" = ${sample.id}
      `;
      this.logger.log(`Created embedding for sample query ${sample.id}`);
    } catch (e) {
      this.logger.warn(`Failed to generate embedding for sample query ${sample.id}: ${e.message}`);
    }

    return sample;
  }

  async updateSampleQuery(id: string, data: Partial<{
    naturalQuery: string;
    sqlQuery: string;
    description: string;
    tags: string[];
    isVerified: boolean;
  }>) {
    const sample = await this.prisma.sampleQuery.update({
      where: { id },
      data,
    });

    // If natural query or sql changed, update embedding
    if (data.naturalQuery || data.sqlQuery || data.description) {
      try {
        const fullSample = await this.prisma.sampleQuery.findUnique({ where: { id } });
        if (fullSample) {
            const embeddingText = `Question: ${fullSample.naturalQuery}\nSQL: ${fullSample.sqlQuery}\nDescription: ${fullSample.description || ''}`;
            const embedding = await this.llmService.generateEmbedding(embeddingText);
            const vectorString = `[${embedding.join(',')}]`;

            await this.prisma.$executeRaw`
                UPDATE "SampleQuery"
                SET "embedding" = ${vectorString}::vector
                WHERE "id" = ${id}
            `;
            this.logger.log(`Updated embedding for sample query ${id}`);
        }
      } catch (e) {
        this.logger.warn(`Failed to update embedding for sample query ${id}: ${e.message}`);
      }
    }

    return sample;
  }

  async deleteSampleQuery(id: string) {
    return this.prisma.sampleQuery.delete({ where: { id } });
  }

  // 프롬프트 템플릿 관리
  async getPromptTemplates() {
    return this.prisma.promptTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPromptTemplate(data: {
    name: string;
    type: any; // PromptType enum
    content: string;
    variables?: string[];
  }) {
    return this.prisma.promptTemplate.create({ data });
  }

  async updatePromptTemplate(id: string, data: Partial<{
    name: string;
    type: any;
    content: string;
    variables: string[];
    isActive: boolean;
  }>) {
    return this.prisma.promptTemplate.update({
      where: { id },
      data,
    });
  }

  async deletePromptTemplate(id: string) {
    return this.prisma.promptTemplate.delete({ where: { id } });
  }

  // ==========================================
  // 정책 관리 (Governance)
  // ==========================================
  async getPolicies() {
    // Using 'any' cast for table name until generated
    return this.prisma['governancePolicy'].findMany({
      orderBy: { priority: 'desc' },
    });
  }

  async createPolicy(data: {
    name: string;
    type: any; // PolicyType
    description?: string;
    config: any;
    priority?: number;
    createdById?: string;
  }) {
    return this.prisma['governancePolicy'].create({ data });
  }

  async updatePolicy(id: string, data: Partial<{
    name: string;
    type: any;
    description: string;
    config: any;
    isActive: boolean;
    priority: number;
  }>) {
    return this.prisma['governancePolicy'].update({
      where: { id },
      data,
    });
  }

  async deletePolicy(id: string) {
    return this.prisma['governancePolicy'].delete({ where: { id } });
  }

  async simulatePolicy(config: any) {
    const recentQueries = await this.prisma.queryHistory.findMany({
      where: { status: 'SUCCESS' },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, generatedSql: true, naturalQuery: true }
    });

    let blockedCount = 0;
    const affectedQueries = [];

    for (const query of recentQueries) {
      if (!query.generatedSql) continue;

      let blocked = false;
      let reason = '';
      const upperSql = query.generatedSql.toUpperCase();
      const joinCount = (upperSql.match(/\bJOIN\b/g) || []).length;

      if (config.maxJoins && joinCount > config.maxJoins) {
        blocked = true;
        reason = `Exceeds max ${config.maxJoins} JOINs`;
      }
      
      if (config.forbiddenKeywords && Array.isArray(config.forbiddenKeywords)) {
           for (const word of config.forbiddenKeywords) {
               if (upperSql.includes(word.toUpperCase())) {
                   blocked = true;
                   reason = `Contains forbidden keyword '${word}'`;
                   break;
               }
           }
      }

      if (blocked) {
        blockedCount++;
        affectedQueries.push({ 
            id: query.id, 
            question: query.naturalQuery,
            reason 
        });
      }
    }

    return { 
        totalChecked: recentQueries.length,
        blockedCount, 
        impactRate: recentQueries.length > 0 ? (blockedCount / recentQueries.length * 100).toFixed(1) : 0,
        affectedSamples: affectedQueries.slice(0, 5) 
    };
  }
}
