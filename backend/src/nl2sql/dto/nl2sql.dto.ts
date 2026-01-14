import { IsString, IsBoolean, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Feedback } from '@prisma/client';

export class GenerateQueryDto {
  @ApiProperty({ example: 'uuid-of-datasource' })
  @IsString()
  dataSourceId: string;

  @ApiProperty({ example: '최근 1주일간 주문 건수를 알려줘' })
  @IsString()
  question: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  autoExecute?: boolean;

  @ApiProperty({ description: '쓰레드 ID (대화 문맥 유지용)', required: false })
  @IsOptional()
  @IsString()
  threadId?: string;
}

export class ExecuteQueryDto {
  @ApiProperty({ required: false, description: '수정된 SQL (선택)' })
  @IsOptional()
  @IsString()
  sql?: string;
}

export class FeedbackDto {
  @ApiProperty({ enum: ['POSITIVE', 'NEGATIVE'] })
  @IsIn(['POSITIVE', 'NEGATIVE'])
  feedback: Feedback;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
