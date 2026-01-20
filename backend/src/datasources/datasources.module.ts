import { Module } from '@nestjs/common';
import { DataSourcesService } from './datasources.service';
import { DataSourcesController } from './datasources.controller';
import { DataSourceAccessService } from './datasource-access.service';

@Module({
  providers: [DataSourcesService, DataSourceAccessService],
  controllers: [DataSourcesController],
  exports: [DataSourcesService, DataSourceAccessService],
})
export class DataSourcesModule {}
