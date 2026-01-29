import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LLMService } from '../llm/llm.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';

import { EmbeddingService } from '../embedding/embedding.service';
import { EmbeddableType } from '../embedding/dto/embedding.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private auditService: AuditService,
    private embeddingService: EmbeddingService,
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
    embeddingModel?: string;
    embeddingBaseUrl?: string;
    apiKey?: string;
    isDefault?: boolean;
    isEmbeddingDefault?: boolean;
    config?: any;
  }) {
    if (data.isDefault) {
      await this.prisma.lLMProvider.updateMany({
        data: { isDefault: false },
      });
    }
    if (data.isEmbeddingDefault) {
      await this.prisma.lLMProvider.updateMany({
        data: { isEmbeddingDefault: false },
      });
    }

    return this.prisma.lLMProvider.create({ data });
  }

  async updateLLMProvider(id: string, data: Partial<{
    baseUrl: string;
    model: string;
    embeddingModel: string;
    embeddingBaseUrl: string;
    apiKey: string;
    isActive: boolean;
    isDefault: boolean;
    isEmbeddingDefault: boolean;
    config: any;
  }>) {
    if (data.isDefault) {
      await this.prisma.lLMProvider.updateMany({
        data: { isDefault: false },
      });
    }
    if (data.isEmbeddingDefault) {
      await this.prisma.lLMProvider.updateMany({
        data: { isEmbeddingDefault: false },
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

  async testLLMProvider(data: {
    name: string;
    baseUrl: string;
    model: string;
    apiKey?: string;
    config?: any;
  }) {
    return this.llmService.testProviderConnection(data);
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

  async updateUserRole(userId: string, role: 'USER' | 'ADMIN', auditContext?: { userId?: string; userEmail?: string; userName?: string; ipAddress?: string; userAgent?: string }) {
    const prevUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    // 감사 로그: 역할 변경
    await this.auditService.logUserManagement('ROLE_CHANGE', `사용자 역할 변경: ${user.email}`, {
      ...auditContext,
      metadata: { targetUserId: userId, targetEmail: user.email },
      previousValue: { role: prevUser?.role },
      newValue: { role },
    });

    return user;
  }

  async toggleUserActive(userId: string, auditContext?: { userId?: string; userEmail?: string; userName?: string; ipAddress?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user?.isActive },
    });

    // 감사 로그: 사용자 활성화/비활성화
    const action = updatedUser.isActive ? 'ACTIVATE' : 'DEACTIVATE';
    await this.auditService.logUserManagement(action, `사용자 ${updatedUser.isActive ? '활성화' : '비활성화'}: ${updatedUser.email}`, {
      ...auditContext,
      metadata: { targetUserId: userId, targetEmail: updatedUser.email },
      previousValue: { isActive: user?.isActive },
      newValue: { isActive: updatedUser.isActive },
    });

    return updatedUser;
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
  }, auditContext?: { userId?: string; userEmail?: string; userName?: string; ipAddress?: string; userAgent?: string }) {
    // Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const preferences = data.department ? { department: data.department } : {};
    
    const user = await this.prisma.user.create({
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

    // 감사 로그: 사용자 생성
    await this.auditService.logUserManagement('CREATE', `사용자 생성: ${user.email}`, {
      ...auditContext,
      metadata: { targetUserId: user.id, targetEmail: user.email, role: user.role },
    });

    return user;
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

  async deleteUser(userId: string, auditContext?: { userId?: string; userEmail?: string; userName?: string; ipAddress?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    // Soft delete approach: just deactivate and anonymize
    // Or hard delete if preferred
    const result = await this.prisma.user.delete({ where: { id: userId } });

    // 감사 로그: 사용자 삭제
    await this.auditService.logUserManagement('DELETE', `사용자 삭제: ${user?.email}`, {
      ...auditContext,
      metadata: { targetUserId: userId, targetEmail: user?.email },
    });

    return result;
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
    category?: string;
    tags?: string[];
  }) {
    // 0. Analyze SQL (Async but await for simplicity in Admin context)
    const analysis = await this.llmService.analyzeSqlMetadata(data.sqlQuery);

    // 1. Create Basic Record
    const sample = await this.prisma.sampleQuery.create({ 
        data: {
            ...data,
            analysis
        } 
    });

    // 2. Sync with EmbeddableItem
    try {
      // Optimize for similarity search: Use ONLY the natural query for embedding content.
      const content = data.naturalQuery;
      
      const embeddableItem = await this.embeddingService.createItem({
        type: EmbeddableType.SAMPLE_QUERY,
        sourceId: sample.id,
        content: content,
        dataSourceId: data.dataSourceId,
        metadata: {
            sql: data.sqlQuery,
            question: data.naturalQuery,
            description: data.description,
            category: data.category,
            tags: data.tags
        }
      });
      
      // Generate Embedding immediately
      await this.embeddingService.generateEmbedding(embeddableItem.id);
      
      this.logger.log(`Created and embedded SampleQuery item ${sample.id}`);
    } catch (e) {
      this.logger.warn(`Failed to sync SampleQuery to EmbeddableItem: ${e.message}`);
    }

    return sample;
  }

  async updateSampleQuery(id: string, data: Partial<{
    naturalQuery: string;
    sqlQuery: string;
    description: string;
    category: string;
    tags: string[];
    isVerified: boolean;
    dataSourceId: string;
  }>) {
    const { dataSourceId, ...rest } = data;
    const updateData: any = { ...rest };
    
    // Explicitly handle dataSourceId if present
    if (dataSourceId) {
        updateData.dataSource = { connect: { id: dataSourceId } };
    }

    // specific check for SQL change to re-analyze
    if (data.sqlQuery) {
        const analysis = await this.llmService.analyzeSqlMetadata(data.sqlQuery);
        updateData.analysis = analysis;
    }

    const sample = await this.prisma.sampleQuery.update({
      where: { id },
      data: updateData,
    });

    // Sync Update to EmbeddableItem
    if (data.naturalQuery || data.sqlQuery || data.description) {
      try {
        const fullSample = await this.prisma.sampleQuery.findUnique({ where: { id } });
        if (fullSample) {
            // Optimize for similarity search: Use ONLY the natural query for embedding content.
            const content = fullSample.naturalQuery;
            
            // Find existing item
            const existingItem = await this.prisma.embeddableItem.findFirst({
                where: { sourceId: id, type: EmbeddableType.SAMPLE_QUERY }
            });

            if (existingItem) {
                await this.embeddingService.updateItem(existingItem.id, {
                    content,
                    metadata: {
                        sql: fullSample.sqlQuery,
                        question: fullSample.naturalQuery,
                        description: fullSample.description,
                        tags: fullSample.tags
                    },
                    isActive: data.isVerified // If verification status changes, maybe toggle active? For now keep true.
                });
                await this.embeddingService.generateEmbedding(existingItem.id);
            } else {
                // If missing, create it
                const newItem = await this.embeddingService.createItem({
                    type: EmbeddableType.SAMPLE_QUERY,
                    sourceId: id,
                    content,
                    dataSourceId: fullSample.dataSourceId,
                    metadata: {
                        sql: fullSample.sqlQuery,
                        question: fullSample.naturalQuery,
                        description: fullSample.description,
                        tags: fullSample.tags
                    }
                });
                await this.embeddingService.generateEmbedding(newItem.id);
            }
            
            this.logger.log(`Updated EmbeddableItem for SampleQuery ${id}`);
        }
      } catch (e) {
        this.logger.warn(`Failed to update EmbeddableItem for SampleQuery ${id}: ${e.message}`);
      }
    }

    return sample;
  }

  async deleteSampleQuery(id: string) {
    // Delete associated EmbeddableItem first
    try {
        await this.prisma.embeddableItem.deleteMany({
            where: { sourceId: id, type: EmbeddableType.SAMPLE_QUERY }
        });
    } catch (e) {}

    return this.prisma.sampleQuery.delete({ where: { id } });
  }

  async bulkUpdateSampleQueries(ids: string[], action: 'DELETE' | 'ACTIVATE' | 'DEACTIVATE') {
    if (action === 'DELETE') {
        // Embeddable Items cleanup would be needed effectively
        try {
            await this.prisma.embeddableItem.deleteMany({
                where: { 
                    sourceId: { in: ids },
                    type: EmbeddableType.SAMPLE_QUERY 
                }
            });
        } catch(e) {}

        return this.prisma.sampleQuery.deleteMany({
            where: { id: { in: ids } }
        });
    } else {
        const isActive = action === 'ACTIVATE';
        // Sync to EmbeddableItem as well
         try {
            await this.prisma.embeddableItem.updateMany({
                where: { 
                    sourceId: { in: ids },
                    type: EmbeddableType.SAMPLE_QUERY 
                },
                data: { isActive }
            });
        } catch(e) {}

        return this.prisma.sampleQuery.updateMany({
            where: { id: { in: ids } },
            data: { isActive }
        });
    }
  }

  async generateAISampleQueries(dataSourceId: string, count: number = 5) {
    // 1. Fetch Schema Context
    const tables = await this.prisma.tableMetadata.findMany({
      where: { dataSourceId, isExcluded: false },
      include: {
        columns: {
          where: { isExcluded: false },
          select: { columnName: true, dataType: true, description: true },
        },
      },
      take: 20, // Limit context size
    });

    if (tables.length === 0) {
      throw new Error('No tables found for this datasource to generate queries.');
    }

    const schemaContext = tables.map(t => {
      const cols = t.columns.map(c => `${c.columnName} (${c.dataType})${c.description ? `: ${c.description}` : ''}`).join(', ');
      return `Table: ${t.schemaName}.${t.tableName}${t.description ? ` - ${t.description}` : ''}\nColumns: ${cols}`;
    }).join('\n\n');

    // 2. Generate Pairs
    const pairs = await this.llmService.generateSampleQueryPairs(schemaContext, count);
    
    return {
        generated: pairs.length,
        items: pairs
    };
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
  async getRecommendedQuestions(
    dataSourceId?: string,
    page = 1,
    limit = 20,
    search?: string,
    source?: string,
  ) {
    const where: any = {};

    if (dataSourceId) {
      where.dataSourceId = dataSourceId;
    }

    if (source) {
      where.source = source;
    }

    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.recommendedQuestion.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          dataSource: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.recommendedQuestion.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRecommendedQuestionsStats(dataSourceId?: string) {
    const where: any = {};
    if (dataSourceId) {
      where.dataSourceId = dataSourceId;
    }

    const [
      totalCount,
      activeCount,
      inactiveCount,
      aiGeneratedCount,
      queryPageCount,
      adminCount,
      systemCount,
      totalUseCount,
    ] = await Promise.all([
      this.prisma.recommendedQuestion.count({ where }),
      this.prisma.recommendedQuestion.count({ where: { ...where, isActive: true } }),
      this.prisma.recommendedQuestion.count({ where: { ...where, isActive: false } }),
      this.prisma.recommendedQuestion.count({ where: { ...where, isAIGenerated: true } }),
      this.prisma.recommendedQuestion.count({ where: { ...where, source: 'QUERY_PAGE' } }),
      this.prisma.recommendedQuestion.count({ where: { ...where, source: 'ADMIN' } }),
      this.prisma.recommendedQuestion.count({ where: { ...where, source: 'SYSTEM' } }),
      this.prisma.recommendedQuestion.aggregate({
        where,
        _sum: { useCount: true },
      }),
    ]);

    return {
      total: totalCount,
      active: activeCount,
      inactive: inactiveCount,
      aiGenerated: aiGeneratedCount,
      bySource: {
        queryPage: queryPageCount,
        admin: adminCount,
        system: systemCount,
      },
      totalUseCount: totalUseCount._sum.useCount || 0,
    };
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

  // ==========================================
  // 피드백 관리 (Feedback Management)
  // ==========================================

  async getFeedbackList(options: {
    page?: number;
    limit?: number;
    feedback?: 'POSITIVE' | 'NEGATIVE';
    dataSourceId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    hasNote?: boolean;
  }) {
    const {
      page = 1,
      limit = 20,
      feedback,
      dataSourceId,
      userId,
      startDate,
      endDate,
      search,
      hasNote,
    } = options;

    const where: any = {
      feedback: { not: null }, // Only queries with feedback
    };

    if (feedback) where.feedback = feedback;
    if (dataSourceId) where.dataSourceId = dataSourceId;
    if (userId) where.userId = userId;
    if (hasNote === true) where.feedbackNote = { not: null };
    if (hasNote === false) where.feedbackNote = null;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (search) {
      where.OR = [
        { naturalQuery: { contains: search, mode: 'insensitive' } },
        { generatedSql: { contains: search, mode: 'insensitive' } },
        { feedbackNote: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.queryHistory.findMany({
        where,
        select: {
          id: true,
          naturalQuery: true,
          generatedSql: true,
          feedback: true,
          feedbackNote: true,
          status: true,
          trustScore: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          dataSource: { select: { id: true, name: true, type: true } },
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

  async getFeedbackStats(options: {
    startDate?: Date;
    endDate?: Date;
    dataSourceId?: string;
  } = {}) {
    const { startDate, endDate, dataSourceId } = options;

    const baseWhere: any = {
      feedback: { not: null },
    };
    if (dataSourceId) baseWhere.dataSourceId = dataSourceId;
    if (startDate || endDate) {
      baseWhere.createdAt = {};
      if (startDate) baseWhere.createdAt.gte = startDate;
      if (endDate) baseWhere.createdAt.lte = endDate;
    }

    // Overall stats
    const [positive, negative, withNote, total] = await Promise.all([
      this.prisma.queryHistory.count({ where: { ...baseWhere, feedback: 'POSITIVE' } }),
      this.prisma.queryHistory.count({ where: { ...baseWhere, feedback: 'NEGATIVE' } }),
      this.prisma.queryHistory.count({ where: { ...baseWhere, feedbackNote: { not: null } } }),
      this.prisma.queryHistory.count({ where: baseWhere }),
    ]);

    // By data source
    const byDataSource = await this.prisma.queryHistory.groupBy({
      by: ['dataSourceId', 'feedback'],
      where: baseWhere,
      _count: true,
    });

    // Format data source stats
    const dataSourceStats: Record<string, { positive: number; negative: number }> = {};
    for (const item of byDataSource) {
      if (!item.dataSourceId) continue;
      if (!dataSourceStats[item.dataSourceId]) {
        dataSourceStats[item.dataSourceId] = { positive: 0, negative: 0 };
      }
      if (item.feedback === 'POSITIVE') {
        dataSourceStats[item.dataSourceId].positive = item._count;
      } else if (item.feedback === 'NEGATIVE') {
        dataSourceStats[item.dataSourceId].negative = item._count;
      }
    }

    // Get data source names
    const dataSourceIds = Object.keys(dataSourceStats);
    const dataSources = await this.prisma.dataSource.findMany({
      where: { id: { in: dataSourceIds } },
      select: { id: true, name: true },
    });
    const dataSourceMap = dataSources.reduce((acc, ds) => {
      acc[ds.id] = ds.name;
      return acc;
    }, {} as Record<string, string>);

    // Daily trend (last 30 days) - simplified query without dynamic dataSourceId filter
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let dailyFeedback: Array<{ date: Date; feedback: string; count: number }> = [];
    try {
      const rawResult = await this.prisma.$queryRaw<Array<{ date: Date; feedback: string; count: bigint }>>`
        SELECT 
          DATE("createdAt") as date,
          "feedback",
          COUNT(*)::int as count
        FROM "QueryHistory"
        WHERE "feedback" IS NOT NULL
          AND "createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE("createdAt"), "feedback"
        ORDER BY date DESC
        LIMIT 60
      `;
      dailyFeedback = rawResult.map(d => ({
        date: d.date,
        feedback: d.feedback,
        count: Number(d.count),
      }));
    } catch (e) {
      this.logger.warn(`Failed to fetch daily feedback trend: ${e.message}`);
    }

    // Top negative feedback users
    const topNegativeUsers = await this.prisma.queryHistory.groupBy({
      by: ['userId'],
      where: { ...baseWhere, feedback: 'NEGATIVE' },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    });

    const userIds = topNegativeUsers.map(u => u.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = users.reduce((acc, u) => {
      acc[u.id] = { name: u.name, email: u.email };
      return acc;
    }, {} as Record<string, { name: string; email: string }>);

    return {
      summary: {
        total,
        positive,
        negative,
        withNote,
        positiveRate: total > 0 ? ((positive / total) * 100).toFixed(1) : '0',
      },
      byDataSource: Object.entries(dataSourceStats).map(([id, stats]) => ({
        id,
        name: dataSourceMap[id] || 'Unknown',
        ...stats,
      })),
      dailyTrend: dailyFeedback,
      topNegativeUsers: topNegativeUsers.map(u => ({
        userId: u.userId,
        ...userMap[u.userId],
        count: u._count,
      })),
    };
  }

  async getFeedbackById(id: string) {
    return this.prisma.queryHistory.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        dataSource: { select: { id: true, name: true, type: true } },
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async updateFeedback(id: string, data: { feedbackNote?: string }) {
    return this.prisma.queryHistory.update({
      where: { id },
      data: {
        feedbackNote: data.feedbackNote,
      },
    });
  }

  async deleteFeedback(id: string) {
    return this.prisma.queryHistory.update({
      where: { id },
      data: {
        feedback: null,
        feedbackNote: null,
      },
    });
  }

  async deleteFeedbackBulk(ids: string[]) {
    return this.prisma.queryHistory.updateMany({
      where: { id: { in: ids } },
      data: {
        feedback: null,
        feedbackNote: null,
      },
    });
  }

  async exportFeedback(options: {
    feedback?: 'POSITIVE' | 'NEGATIVE';
    dataSourceId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {
      feedback: { not: null },
    };

    if (options.feedback) where.feedback = options.feedback;
    if (options.dataSourceId) where.dataSourceId = options.dataSourceId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const items = await this.prisma.queryHistory.findMany({
      where,
      select: {
        id: true,
        naturalQuery: true,
        generatedSql: true,
        feedback: true,
        feedbackNote: true,
        status: true,
        trustScore: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        dataSource: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generate CSV content
    const headers = ['ID', 'Date', 'User', 'Email', 'DataSource', 'Feedback', 'Question', 'SQL', 'Note', 'Trust Score', 'Status'];
    const rows = items.map(item => [
      item.id,
      item.createdAt.toISOString(),
      item.user?.name || '',
      item.user?.email || '',
      item.dataSource?.name || '',
      item.feedback || '',
      `"${(item.naturalQuery || '').replace(/"/g, '""')}"`,
      `"${(item.generatedSql || '').replace(/"/g, '""')}"`,
      `"${(item.feedbackNote || '').replace(/"/g, '""')}"`,
      item.trustScore?.toFixed(2) || '',
      item.status || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    return {
      filename: `feedback_export_${new Date().toISOString().split('T')[0]}.csv`,
      content: csv,
      count: items.length,
    };
  }
}
