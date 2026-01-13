import { Module } from '@nestjs/common';
import { QueryService } from './query.service';
import { QueryController } from './query.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [QueryService],
  controllers: [QueryController],
  exports: [QueryService],
})
export class QueryModule {}
