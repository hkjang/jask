import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsBoolean, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

// Enums (must match Prisma enums)
export enum SearchMethod {
  DENSE = 'DENSE',
  SPARSE = 'SPARSE',
  HYBRID = 'HYBRID',
}

export enum EmbeddableType {
  TABLE = 'TABLE',
  COLUMN = 'COLUMN',
  SAMPLE_QUERY = 'SAMPLE_QUERY',
  DOCUMENT = 'DOCUMENT',
  CUSTOM = 'CUSTOM',
}

// ===========================================
// Embedding Config DTOs
// ===========================================
export class CreateEmbeddingConfigDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  topK?: number;

  @IsOptional()
  @IsEnum(SearchMethod)
  searchMethod?: SearchMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  denseWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  sparseWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rrfK?: number;

  @IsOptional()
  @IsString()
  embeddingModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(128)
  dimensions?: number;

  @IsOptional()
  @IsString()
  dataSourceId?: string;
}

export class UpdateEmbeddingConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  topK?: number;

  @IsOptional()
  @IsEnum(SearchMethod)
  searchMethod?: SearchMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  denseWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  sparseWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rrfK?: number;

  @IsOptional()
  @IsString()
  embeddingModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(128)
  dimensions?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  dataSourceId?: string;
}

// ===========================================
// Embeddable Item DTOs
// ===========================================
export class CreateEmbeddableItemDto {
  @IsEnum(EmbeddableType)
  type: EmbeddableType;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsString()
  content: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  dataSourceId?: string;
}

export class UpdateEmbeddableItemDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListEmbeddableItemsDto {
  @IsOptional()
  @IsEnum(EmbeddableType)
  type?: EmbeddableType;

  @IsOptional()
  @IsString()
  dataSourceId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}

export class BatchEmbedDto {
  @IsOptional()
  @IsString()
  dataSourceId?: string;

  @IsOptional()
  @IsEnum(EmbeddableType)
  type?: EmbeddableType;

  @IsOptional()
  @IsBoolean()
  forceRegenerate?: boolean;
}

// ===========================================
// Search DTOs
// ===========================================
export class SearchDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  dataSourceId?: string;

  @IsOptional()
  @IsUUID()
  configId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  topK?: number;

  @IsOptional()
  @IsEnum(SearchMethod)
  searchMethod?: SearchMethod;

  @IsOptional()
  @IsEnum(EmbeddableType)
  type?: EmbeddableType;
}

// ===========================================
// Response Types
// ===========================================
export interface SearchResult {
  id: string;
  content: string;
  type: EmbeddableType;
  sourceId?: string;
  denseScore?: number;
  sparseScore?: number;
  hybridScore?: number;
  metadata?: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchMethod: SearchMethod;
  timing: {
    denseTimeMs?: number;
    sparseTimeMs?: number;
    totalTimeMs: number;
  };
}

export interface BatchEmbedResponse {
  success: number;
  failed: number;
  skipped: number;
  errors?: { id: string; error: string }[];
}
