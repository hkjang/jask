import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PolicyAdjustmentController } from './policy-adjustment.controller';
import { PolicyAdjustmentService } from './policy-adjustment.service';

@Module({
  imports: [PrismaModule],
  controllers: [PolicyAdjustmentController],
  providers: [PolicyAdjustmentService],
  exports: [PolicyAdjustmentService],
})
export class PolicyAdjustmentModule {}
