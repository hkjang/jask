import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EvolutionAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const totalCandidates = await this.prisma.evolutionCandidate.count();
    const appliedCandidates = await this.prisma.evolutionCandidate.count({ where: { status: 'APPLIED' } });
    const pendingCandidates = await this.prisma.evolutionCandidate.count({ where: { status: 'PENDING' } });
    
    // Average Trust Score form Signals (Recent 7 days)
    const recentSignals = await this.prisma.evolutionSignal.findMany({
      where: {
        signalType: 'TRUST_SCORE',
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      select: { score: true }
    });

    const avgTrustScore = recentSignals.length > 0
      ? recentSignals.reduce((acc, curr) => acc + curr.score, 0) / recentSignals.length
      : 0;

    return {
      candidates: {
        total: totalCandidates,
        applied: appliedCandidates,
        pending: pendingCandidates
      },
      trustScore: {
        average: avgTrustScore,
        sampleSize: recentSignals.length
      }
    };
  }
}
