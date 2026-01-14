import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { PolicyAdjustmentService } from './policy-adjustment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('evolution/policy')
@UseGuards(JwtAuthGuard)
export class PolicyAdjustmentController {
  constructor(private readonly policyService: PolicyAdjustmentService) {}

  @Get('logs')
  async getAdjustmentLogs() {
    return this.policyService.getAdjustmentLogs();
  }

  @Post('log/:id/revert')
  async revertLog(@Param('id') id: string) {
    return this.policyService.revertAdjustment(id);
  }

  @Get('metrics')
  async getMetrics() {
    return this.policyService.getMetrics();
  }

  @Get('rules')
  async getRules() {
    return this.policyService.getRules();
  }

  @Post('rule/:id/toggle')
  async toggleRule(@Body() body: { id: string; isActive: boolean }) {
    return this.policyService.toggleRuleStatus(body.id, body.isActive);
  }

  @Post('trigger')
  async createTrigger(@Body() body: any) {
    return this.policyService.createTrigger(body);
  }

  @Patch('trigger/:id')
  async updateTrigger(@Param('id') id: string, @Body() body: any) {
    return this.policyService.updateTrigger(id, body);
  }

  @Post('rule')
  async createRule(@Body() body: any) {
    return this.policyService.createRule(body);
  }

  @Post('run-check')
  async runManualCheck() {
    await this.policyService.checkAndApplyRules();
    return { success: true, message: 'Policy check triggered manually.' };
  }
}
