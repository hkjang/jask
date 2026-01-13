import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SignalProcessorService {
  private readonly logger = new Logger(SignalProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Run every hour
  @Cron(CronExpression.EVERY_HOUR)
  async processSignals() {
    this.logger.log('Starting signal processing...');
    
    // 1. Calculate Trust Scores
    await this.calculateTrustScores();

    // 2. Identify Error Patterns (High Edit Rate)
    await this.identifyErrorPatterns();

    this.logger.log('Signal processing completed.');
  }

  private async calculateTrustScores() {
    // 1. Get recent EXECUTE actions
    const recentExecutions = await this.prisma.userActionLog.findMany({
      where: {
        actionType: 'EXECUTE',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      },
      include: { query: true }
    });

    for (const execution of recentExecutions) {
      if (!execution.queryId) continue;

      // Check if there was an EDIT action for this query
      const editAction = await this.prisma.userActionLog.findFirst({
        where: {
          queryId: execution.queryId,
          actionType: 'EDIT'
        }
      });

      // Check for Feedback
      const feedbackAction = await this.prisma.userActionLog.findFirst({
          where: { queryId: execution.queryId, actionType: 'RATE' }
      });

      let score = 0.5; // Default neutral
      let type = 'TRUST_SCORE';

      if (editAction) {
        score = 0.2; // Low trust if edited (original was bad)
        type = 'ERROR_SIGNAL';
      } else {
        score = 0.8; // High trust if executed without edit
      }

      if (feedbackAction?.payload) {
          const p = feedbackAction.payload as any;
          if (p.rating === 'POSITIVE') score = Math.min(score + 0.2, 1.0);
          if (p.rating === 'NEGATIVE') score = Math.max(score - 0.4, 0.0);
      }

      // Save Signal
      if (execution.query) {
         // We might want to link this to the Prompt or Metadata used
         // For now, let's link to the QueryId as a proxy or if we had TableId
         await this.prisma.evolutionSignal.create({
             data: {
                 targetId: execution.query.dataSourceId, // Signal about the DataSource
                 signalType: type,
                 score: score,
                 confidence: 0.8,
                 dataset: { queryId: execution.queryId, sql: execution.payload } as any
             }
         });
      }
    }
  }

  private async identifyErrorPatterns() {
      // Find queries that were ABANDONED (High risk)
      // Implementation pending
  }
}
