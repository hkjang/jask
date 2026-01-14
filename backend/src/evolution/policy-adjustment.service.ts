import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PolicyArea, ExecutionMethod, PolicyTrigger, PolicyAdjustmentRule } from '@prisma/client';

@Injectable()
export class PolicyAdjustmentService {
  private readonly logger = new Logger(PolicyAdjustmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkAndApplyRules() {
    this.logger.log('Starting policy adjustment check...');
    
    // 1. Fetch active triggers
    const activeTriggers = await this.prisma.policyTrigger.findMany({
      where: { isActive: true },
      include: { rules: { where: { isActive: true } } },
    });

    if (activeTriggers.length === 0) return;

    // 2. Fetch Metrics (Simulated or Aggregated)
    const metrics = await this.fetchCurrentMetrics();

    // 3. Evaluate Triggers
    for (const trigger of activeTriggers) {
      const isTriggered = this.evaluateTrigger(trigger, metrics);
      
      if (isTriggered) {
        this.logger.log(`Trigger [${trigger.name}] activated.`);
        
        // 4. Execute Linked Rules
        for (const rule of trigger.rules) {
          await this.applyRule(rule, `Triggered by ${trigger.name}`);
        }
      }
    }
  }

  async getMetrics() {
    return this.fetchCurrentMetrics();
  }

  // Helper: Fetch current system metrics
  private async fetchCurrentMetrics(): Promise<Record<string, number>> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // 1. Error Rate (Failed Queries / Total Queries)
    const totalQueries = await this.prisma.queryHistory.count({
        where: { createdAt: { gte: oneWeekAgo } }
    });
    
    const failedQueries = await this.prisma.queryHistory.count({
        where: { 
            createdAt: { gte: oneWeekAgo },
            status: 'FAILED'
        }
    });

    const errorRate = totalQueries > 0 ? (failedQueries / totalQueries) * 100 : 0;
    
    // 2. Utilization Score (actions per day)
    const actionCount = await this.prisma.userActionLog.count({
        where: { createdAt: { gte: oneWeekAgo } }
    });
    const utilizationScore = actionCount / 7; // avg daily actions

    // 3. Trust Score (Average of Evolution Signals)
    const trustSignals = await this.prisma.evolutionSignal.findMany({
        where: {
            signalType: 'TRUST_SCORE',
            updatedAt: { gte: oneWeekAgo }
        },
        select: { score: true }
    });

    const avgTrustScore = trustSignals.length > 0
        ? (trustSignals.reduce((acc, curr) => acc + curr.score, 0) / trustSignals.length) * 100
        : 100; // Default to 100 if no signals

    // 4. Rework Index (Edit/Re-ask Ratio)
    const reworkActions = await this.prisma.userActionLog.count({
        where: {
            createdAt: { gte: oneWeekAgo },
            actionType: { in: ['EDIT', 'RE_ASK'] }
        }
    });

    // We compare rework actions to total "QUERY" actions to see how often users have to fix things
    const queryActions = await this.prisma.userActionLog.count({
        where: {
            createdAt: { gte: oneWeekAgo },
            actionType: 'QUERY'
        }
    });

    // Index = (Reworks / Queries) * 10. E.g., 2 reworks per 10 queries = 0.2 * 10 = 2.
    const reworkIndex = queryActions > 0 ? (reworkActions / queryActions) * 10 : 0;

    return {
      'error_rate': errorRate,
      'utilization_score': utilizationScore,
      'trust_score': avgTrustScore,
      'rework_index': reworkIndex,
    };
  }

  private evaluateTrigger(trigger: PolicyTrigger, metrics: Record<string, number>): boolean {
    const currentValue = metrics[trigger.metric];
    if (currentValue === undefined) {
        this.logger.warn(`Metric [${trigger.metric}] not found for trigger [${trigger.name}]`);
        return false;
    }

    switch (trigger.operator) {
      case 'GT': return currentValue > trigger.threshold;
      case 'GTE': return currentValue >= trigger.threshold;
      case 'LT': return currentValue < trigger.threshold;
      case 'LTE': return currentValue <= trigger.threshold;
      case 'EQ': return currentValue === trigger.threshold;
      default: return false;
    }
  }

  async applyRule(rule: PolicyAdjustmentRule, reason: string) {
    this.logger.log(`Applying Rule: ${rule.name} (${rule.method})`);

    // Fetch current value (This would assume a dynamic config system exists, e.g., SystemSettings)
    // For this prototype, we mock the "previous value" lookup
    const systemSetting = await this.prisma.systemSettings.findUnique({
        where: { key: rule.targetParameter }
    });

    const previousValue = systemSetting?.value || null;
    const newValue = rule.adjustmentValue;

    if (rule.method === 'IMMEDIATE') {
        // Apply change to SystemSettings
        await this.prisma.systemSettings.upsert({
            where: { key: rule.targetParameter },
            update: { value: newValue as any },
            create: { 
                key: rule.targetParameter, 
                value: newValue as any, 
                description: `Auto-adjusted by rule ${rule.name}` 
            }
        });

        // Log the adjustment
        await this.prisma.policyAdjustmentLog.create({
            data: {
                ruleId: rule.id,
                previousValue: previousValue as any,
                newValue: newValue as any,
                reason: reason
            }
        });
        
        this.logger.log(`Rule [${rule.name}] applied successfully.`);
    } else {
        this.logger.log(`Rule [${rule.method}] method not fully implemented yet.`);
    }
  }

  async getAdjustmentLogs() {
    return this.prisma.policyAdjustmentLog.findMany({
        include: { rule: true },
        orderBy: { appliedAt: 'desc' }
    });
  }

  async getRules() {
    return this.prisma.policyAdjustmentRule.findMany({
      include: { triggers: true },
      orderBy: { priority: 'desc' }
    });
  }

  async revertAdjustment(logId: string) {
    const log = await this.prisma.policyAdjustmentLog.findUnique({
        where: { id: logId }
    });

    if (!log || log.revertedAt) {
        throw new Error('Log not found or already reverted.');
    }

    // Identify the parameter key from the rule (need to fetch rule or store parameter in log?)
    // The Schema for Log doesn't store targetParameter directly, only ruleId.
    // However, if the rule is deleted, we might be in trouble. 
    // Ideally, the Log should snapshot the parameter name.
    // BUT looking at the schema: ruleId IS a relation.
    // Let's fetch the rule to get the targetParameter.

    const rule = await this.prisma.policyAdjustmentRule.findUnique({
        where: { id: log.ruleId }
    });

    if (!rule) {
        throw new Error('Associated rule not found. Cannot determine target parameter.');
    }

    // Revert the value
    await this.prisma.systemSettings.update({
        where: { key: rule.targetParameter },
        data: { value: log.previousValue as any }
    });

    // Mark log as reverted
    return this.prisma.policyAdjustmentLog.update({
        where: { id: logId },
        data: { revertedAt: new Date() }
    });
  }

  async toggleRuleStatus(id: string, isActive: boolean) {
    return this.prisma.policyAdjustmentRule.update({
      where: { id },
      data: { isActive }
    });
  }

  async createTrigger(data: any) {
    return this.prisma.policyTrigger.create({ data });
  }

  async updateTrigger(id: string, data: { threshold?: number; windowSeconds?: number; isActive?: boolean }) {
    return this.prisma.policyTrigger.update({
      where: { id },
      data
    });
  }

  async createRule(data: any) {
    return this.prisma.policyAdjustmentRule.create({ data });
  }
}
