import { IsString, IsObject, IsOptional, IsBoolean, IsArray, IsEnum, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ImportanceLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum SensitivityLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  STRICT = 'STRICT',
}

export enum RelationType {
  FK = 'FK',
  LOGICAL = 'LOGICAL',
}

export class UpdateTableMetadataDto {
  @ApiProperty({ example: 'User Information Table', description: 'Business description of the table' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['user', 'auth', 'account'], description: 'Tags for categorization' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ enum: ImportanceLevel, example: ImportanceLevel.HIGH })
  @IsEnum(ImportanceLevel)
  @IsOptional()
  importanceLevel?: ImportanceLevel;

  @ApiProperty({ example: true, description: 'Whether to sync this table with AI context' })
  @IsBoolean()
  @IsOptional()
  isSyncedWithAI?: boolean;

  @ApiProperty({ example: false, description: 'Whether to exclude this table from AI usage' })
  @IsBoolean()
  @IsOptional()
  isExcluded?: boolean;
}

export class UpdateColumnMetadataDto {
  @ApiProperty({ example: 'User Description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'User Name', description: 'Business/Semantic name' })
  @IsString()
  @IsOptional()
  semanticName?: string;

  @ApiProperty({ example: 'kg', required: false })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  isCode?: boolean;

  @ApiProperty({ enum: SensitivityLevel, example: SensitivityLevel.INTERNAL })
  @IsEnum(SensitivityLevel)
  @IsOptional()
  sensitivityLevel?: SensitivityLevel;

  @ApiProperty({ example: false, description: 'Whether to exclude this column from AI usage' })
  @IsBoolean()
  @IsOptional()
  isExcluded?: boolean;
}

export class CreateCodeValueDto {
  @ApiProperty({ example: 'Y' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Yes' })
  @IsString()
  value: string;

  @ApiProperty({ example: 'Active status', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateCodeValueDto extends CreateCodeValueDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateRelationshipDto {
  @ApiProperty({ example: 'uuid-target-table-id' })
  @IsString()
  targetTableId: string;

  @ApiProperty({ enum: RelationType, example: RelationType.LOGICAL })
  @IsEnum(RelationType)
  relationType: RelationType;

  @ApiProperty({ example: 'Logical link between User and Activity', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateDescriptionDto {
  @ApiProperty({ example: 'Legacy description update' })
  @IsString()
  description: string;
}

export class UpdateCodeValuesDto {
  @ApiProperty({ description: 'Legacy code values mapping' })
  @IsObject()
  codeValues: Record<string, string>;
}

// ===========================================
// Excel Import/Export DTOs
// ===========================================

export class MetadataExcelRowDto {
  @ApiProperty({ example: 'users' })
  @IsString()
  tableName: string;

  @ApiProperty({ example: 'user_id' })
  @IsString()
  columnName: string;

  @ApiProperty({ example: '사용자 ID', required: false })
  @IsString()
  @IsOptional()
  semanticName?: string;

  @ApiProperty({ example: '사용자 고유 식별자', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'A=활성, I=비활성', required: false })
  @IsString()
  @IsOptional()
  codeValues?: string;
}

export class ImportMetadataDto {
  @ApiProperty({ type: [MetadataExcelRowDto] })
  @IsArray()
  rows: MetadataExcelRowDto[];
}
