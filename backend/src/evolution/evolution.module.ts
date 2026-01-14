import { Module } from '@nestjs/common';
import { EvolutionController } from './evolution.controller';
import { SignalProcessorService } from './signal-processor.service';
import { EvolutionCandidateService } from './evolution-candidate.service';
import { UserActionService } from './user-action.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EvolutionAnalyticsService } from './evolution-analytics.service';
import { AuthModule } from '../auth/auth.module';
import { PolicyAdjustmentModule } from './policy-adjustment.module';

@Module({
  imports: [PrismaModule, AuthModule, PolicyAdjustmentModule],
  controllers: [EvolutionController],
  providers: [UserActionService, SignalProcessorService, EvolutionCandidateService, EvolutionAnalyticsService],
  exports: [UserActionService, SignalProcessorService, EvolutionCandidateService, EvolutionAnalyticsService, PolicyAdjustmentModule],
})
export class EvolutionModule {}
