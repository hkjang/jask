import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class EvolutionCandidateService {
  private readonly logger = new Logger(EvolutionCandidateService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async generateCandidates() {
    this.logger.log('Starting evolution candidate generation...');
    
    // 1. Find Low Trust Signals
    const lowTrustSignals = await this.prisma.evolutionSignal.findMany({
      where: {
        signalType: 'TRUST_SCORE',
        score: { lt: 0.6 },
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Recent signals
      }
    });

    // Group by TargetId (DataSourceId)
    const signalsByTarget = new Map<string, any[]>();
    lowTrustSignals.forEach(s => {
       const list = signalsByTarget.get(s.targetId) || [];
       list.push(s);
       signalsByTarget.set(s.targetId, list);
    });

    for (const [targetId, signals] of signalsByTarget.entries()) {
       if (signals.length >= 3) { // Threshold: at least 3 low trust queries
           // Check if candidate already exists
           const existing = await this.prisma.evolutionCandidate.findFirst({
               where: {
                   targetId,
                   type: 'METADATA',
                   status: 'PENDING'
               }
           });

            // Aggregate Evidence
            const evidence = signals.map(s => ({
                queryId: s.dataset?.queryId,
                naturalQuery: s.dataset?.naturalQuery || 'Unknown Query',
                score: s.score
            }));

           if (!existing) {
               await this.prisma.evolutionCandidate.create({
                   data: {
                       type: 'METADATA',
                       targetId,
                       proposedChange: { action: 'REVIEW_REQUIRED', reason: 'Low trust score detected multiple times.' },
                       reasoning: `Detected ${signals.length} low trust queries in the last 24 hours. Metadata review recommended.`,
                       impactAnalysis: { evidence },
                       status: 'PENDING'
                   }
               });
               this.logger.log(`Created METADATA candidate for target ${targetId}`);
           }
       }
    }
    
    this.logger.log('Candidate generation completed.');
  }

  async getCandidates() {
    return this.prisma.evolutionCandidate.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });
  }

  async applyCandidate(candidateId: string, approverId?: string) {
    const candidate = await this.prisma.evolutionCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) throw new Error('Candidate not found');

    // 1. Apply Logic
    if (candidate.type === 'METADATA') {
        // e.g., Update TableMetadata description or status
        // For 'REVIEW_REQUIRED', we might just flag the table
        // Implementation relative to metadata module would go here
        this.logger.log(`Applying METADATA change for ${candidate.targetId}`);
    }

    // 2. Update Candidate Status
    return this.prisma.evolutionCandidate.update({
        where: { id: candidateId },
        data: {
            status: 'APPLIED',
            approverId,
            appliedAt: new Date()
        }
    });
  }

  async rejectCandidate(candidateId: string, rejectorId?: string) {
      return this.prisma.evolutionCandidate.update({
          where: { id: candidateId },
          data: {
              status: 'REJECTED',
              approverId: rejectorId, // Using same field for rejector
              appliedAt: new Date()
          }
      });
  }
}
