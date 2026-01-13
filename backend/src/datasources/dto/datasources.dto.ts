import { IsString, IsInt, IsOptional, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateDataSourceDto {
  @ApiProperty({ example: 'Production DB' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'postgresql', enum: ['postgresql', 'mysql'] })
  @IsString()
  @IsIn(['postgresql', 'mysql'])
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
}

export class UpdateDataSourceDto extends PartialType(CreateDataSourceDto) {}

export class TestConnectionDto extends CreateDataSourceDto {}
