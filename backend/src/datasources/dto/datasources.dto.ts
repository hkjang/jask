import { IsString, IsInt, IsOptional, IsIn, Min, Max, IsBoolean, ValidateNested, IsNumber } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// SSL 설정 DTO
export class SslConfigDto {
  @ApiProperty({ example: 'require', enum: ['disable', 'require', 'verify-ca', 'verify-full'] })
  @IsOptional()
  @IsString()
  @IsIn(['disable', 'require', 'verify-ca', 'verify-full'])
  mode?: string;

  @ApiProperty({ example: '-----BEGIN CERTIFICATE-----...', required: false })
  @IsOptional()
  @IsString()
  ca?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cert?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  key?: string;
}

// 연결 풀 설정 DTO
export class PoolConfigDto {
  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxConnections?: number;

  @ApiProperty({ example: 30000, description: 'Connection timeout in ms', required: false })
  @IsOptional()
  @IsInt()
  @Min(1000)
  connectionTimeout?: number;

  @ApiProperty({ example: 60000, description: 'Idle timeout in ms', required: false })
  @IsOptional()
  @IsInt()
  @Min(1000)
  idleTimeout?: number;
}

export class CreateDataSourceDto {
  @ApiProperty({ example: 'Production DB' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'postgresql', enum: ['postgresql', 'mysql', 'oracle'] })
  @IsString()
  @IsIn(['postgresql', 'mysql', 'oracle'])
  type: string;

  @ApiProperty({ example: 'localhost' })
  @IsString()
  host: string;

  @ApiProperty({ example: 5432 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ example: 'mydb' })
  @IsString()
  database: string;

  @ApiProperty({ example: 'postgres' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  password: string;

  @ApiProperty({ example: 'public', required: false })
  @IsOptional()
  @IsString()
  schema?: string;

  @ApiProperty({ example: '프로덕션 데이터베이스 서버', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'production', enum: ['production', 'staging', 'development'], required: false })
  @IsOptional()
  @IsString()
  @IsIn(['production', 'staging', 'development'])
  environment?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  sslEnabled?: boolean;

  @ApiProperty({ type: SslConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => SslConfigDto)
  sslConfig?: SslConfigDto;

  @ApiProperty({ type: PoolConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => PoolConfigDto)
  poolConfig?: PoolConfigDto;
}

export class UpdateDataSourceDto extends PartialType(CreateDataSourceDto) {}

export class TestConnectionDto extends CreateDataSourceDto {}

// 헬스 체크 응답 DTO
export class HealthCheckResponseDto {
  @ApiProperty()
  isHealthy: boolean;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  latency?: number;

  @ApiProperty({ required: false })
  error?: string;

  @ApiProperty()
  checkedAt: Date;
}

// 통계 응답 DTO
export class DataSourceStatisticsDto {
  @ApiProperty()
  queryCount: number;

  @ApiProperty()
  avgResponseTime: number;

  @ApiProperty({ required: false })
  lastActiveAt?: Date;

  @ApiProperty()
  tableCount: number;

  @ApiProperty()
  columnCount: number;

  @ApiProperty({ required: false })
  recentQueries?: any[];
}

// 대시보드 개요 DTO
export class DataSourceOverviewDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  healthy: number;

  @ApiProperty()
  unhealthy: number;

  @ApiProperty()
  unknown: number;

  @ApiProperty()
  byType: Record<string, number>;

  @ApiProperty()
  byEnvironment: Record<string, number>;
}
