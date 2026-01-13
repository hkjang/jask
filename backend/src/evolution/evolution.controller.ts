import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
import { UserActionService } from './user-action.service';
import { EvolutionCandidateService } from './evolution-candidate.service';
import { EvolutionAnalyticsService } from './evolution-analytics.service';
import { ActionType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('evolution')
@UseGuards(JwtAuthGuard)
export class EvolutionController {
  constructor(
    private readonly userActionService: UserActionService,
    private readonly evolutionCandidateService: EvolutionCandidateService,
    private readonly evolutionAnalyticsService: EvolutionAnalyticsService
  ) {}

  @Get('stats')
  async getStats() {
    return this.evolutionAnalyticsService.getStats();
  }

  @Post('actions')
  async logAction(@Req() req: Request, @Body() body: { actionType: ActionType; queryId?: string; payload?: any }) {
    const userId = (req as any).user['id'];
    return this.userActionService.logAction(userId, body.actionType, body.queryId, body.payload);
  }

  @Get('actions/my')
  async getMyActions(@Req() req: Request) {
    const userId = (req as any).user['id'];
    return this.userActionService.getUserActions(userId);
  }

  @Get('candidates')
  async getCandidates(@Req() req: Request) {
    // In a real app, check for admin role
    return this.evolutionCandidateService.getCandidates();
  }

  @Post('candidates/:id/:action')
  async handleCandidateIs(@Req() req: Request, @Param('id') id: string, @Param('action') action: string) {
    const userId = (req as any).user['id'];
    if (action === 'approve') {
       return this.evolutionCandidateService.applyCandidate(id, userId);
    } else {
       return this.evolutionCandidateService.rejectCandidate(id, userId);
    }
  }
}
