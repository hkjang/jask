import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { DataSourcesModule } from '../datasources/datasources.module';
import { ValidationModule } from '../validation/validation.module';

@Module({
  imports: [DataSourcesModule, ValidationModule],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
