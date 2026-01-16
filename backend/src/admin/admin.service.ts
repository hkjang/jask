import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LLMService } from '../llm/llm.service';
import * as bcrypt from 'bcrypt';

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

  async getUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        preferences: true,
        _count: { select: { queries: true } },
      },
    });
  }

  async createUser(data: { 
    email: string; 
    password: string; 
    name: string; 
    role?: 'USER' | 'ADMIN'; 
    department?: string;
  }) {
    // Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const preferences = data.department ? { department: data.department } : {};
    
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role || 'USER',
        preferences,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateUser(userId: string, data: { name?: string; department?: string; email?: string }) {
    const updateData: any = {};
    
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    
    // Handle department in preferences
    if (data.department !== undefined) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const currentPrefs = (user?.preferences as any) || {};
      updateData.preferences = { ...currentPrefs, department: data.department };
    }
    
    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        preferences: true,
      },
    });
  }

  async deleteUser(userId: string) {
    // Soft delete approach: just deactivate and anonymize
    // Or hard delete if preferred
    return this.prisma.user.delete({ where: { id: userId } });
  }

  // 전체 대화 이력 (관리자용)
  async getAllThreads(page = 1, limit = 20, search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { owner: { email: { contains: search, mode: 'insensitive' } } },
          { owner: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.thread.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { id: true, email: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.thread.count({ where }),
    ]);

    return { items, pagination: { page, limit, total } };
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

  // ==========================================
  // 추천 질문 관리
  // ==========================================
  async getRecommendedQuestions(dataSourceId?: string) {
    return this.prisma.recommendedQuestion.findMany({
      where: dataSourceId ? { dataSourceId } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        dataSource: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async getRecommendedQuestion(id: string) {
    return this.prisma.recommendedQuestion.findUnique({
      where: { id },
      include: {
        dataSource: { select: { id: true, name: true, type: true } },
      },
    });
  }

  async createRecommendedQuestion(data: {
    dataSourceId: string;
    question: string;
    category?: string;
    tags?: string[];
    description?: string;
    isAIGenerated?: boolean;
    createdById?: string;
    createdByName?: string;
    source?: string;
  }) {
    return this.prisma.recommendedQuestion.create({
      data: {
        dataSourceId: data.dataSourceId,
        question: data.question,
        category: data.category,
        tags: data.tags || [],
        description: data.description,
        isAIGenerated: data.isAIGenerated || false,
        createdById: data.createdById,
        createdByName: data.createdByName,
        source: data.source || 'ADMIN',
      },
    });
  }

  async updateRecommendedQuestion(id: string, data: Partial<{
    question: string;
    category: string;
    tags: string[];
    description: string;
    isActive: boolean;
    displayOrder: number;
  }>) {
    return this.prisma.recommendedQuestion.update({
      where: { id },
      data,
    });
  }

  async deleteRecommendedQuestion(id: string) {
    return this.prisma.recommendedQuestion.delete({ where: { id } });
  }

  async toggleRecommendedQuestion(id: string) {
    const question = await this.prisma.recommendedQuestion.findUnique({ where: { id } });
    if (!question) throw new Error('Recommended question not found');
    
    return this.prisma.recommendedQuestion.update({
      where: { id },
      data: { isActive: !question.isActive },
    });
  }

  async generateAIRecommendedQuestions(dataSourceId: string, count: number = 5) {
    // Get schema context for the data source
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: false },
      include: {
        columns: {
          where: { isExcluded: false },
          select: { columnName: true, dataType: true, description: true },
        },
      },
      take: 20,
    });

    if (tables.length === 0) {
      return { generated: 0, questions: [] };
    }

    // Build schema context
    const schemaContext = tables.map(t => {
      const cols = t.columns.map(c => `${c.columnName} (${c.dataType})${c.description ? `: ${c.description}` : ''}`).join(', ');
      return `Table: ${t.schemaName}.${t.tableName}${t.description ? ` - ${t.description}` : ''}\nColumns: ${cols}`;
    }).join('\n\n');

    // Generate questions using LLM
    const questions = await this.llmService.generateRecommendedQuestions(schemaContext, count);

    // Save generated questions
    const savedQuestions = [];
    for (const q of questions) {
      try {
        const saved = await this.prisma.recommendedQuestion.create({
          data: {
            dataSourceId,
            question: q,
            isAIGenerated: true,
            isActive: true,
            source: 'ADMIN',
          },
        });
        savedQuestions.push(saved);
      } catch (e) {
        this.logger.warn(`Failed to save recommended question: ${e.message}`);
      }
    }

    return { generated: savedQuestions.length, questions: savedQuestions };
  }

  async incrementRecommendedQuestionUseCount(id: string) {
    return this.prisma.recommendedQuestion.update({
      where: { id },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }
}
