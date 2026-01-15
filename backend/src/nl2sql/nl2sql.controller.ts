import { Controller, Post, Body, Param, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NL2SQLService, NL2SQLRequest } from './nl2sql.service';
import { GenerateQueryDto, ExecuteQueryDto, FeedbackDto } from './dto/nl2sql.dto';

@ApiTags('NL2SQL')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('nl2sql')
export class NL2SQLController {
  constructor(private readonly nl2sqlService: NL2SQLService) {}

  @Post('generate')
  @ApiOperation({ summary: '자연어로 SQL 생성' })
  async generate(@Body() dto: GenerateQueryDto, @Request() req: any) {
    return this.nl2sqlService.generateAndExecute({
      dataSourceId: dto.dataSourceId,
      question: dto.question,
      userId: req.user?.id || 'anonymous',
      autoExecute: dto.autoExecute,
      threadId: dto.threadId,
    } as NL2SQLRequest);
  }

  @Post('generate/stream')
  @ApiOperation({ summary: '자연어로 SQL 생성 (Streaming)' })
  async generateStream(@Body() dto: GenerateQueryDto, @Request() req: any, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Prevent buffering in proxies (Nginx, etc.)

    const stream = this.nl2sqlService.generateAndExecuteStream({
      dataSourceId: dto.dataSourceId,
      question: dto.question,
      userId: req.user?.id || 'anonymous',
      autoExecute: dto.autoExecute,
      threadId: dto.threadId,
    } as NL2SQLRequest);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.end();
  }

  @Post('execute/:queryId')
  @ApiOperation({ summary: '생성된 SQL 실행' })
  async execute(
    @Param('queryId') queryId: string,
    @Body() dto: ExecuteQueryDto,
  ) {
    return this.nl2sqlService.executeQuery(queryId, dto.sql);
  }

  @Post('preview/:queryId')
  @ApiOperation({ summary: 'SQL 미리보기 (제한된 결과)' })
  async preview(
    @Param('queryId') queryId: string,
    @Body() dto: ExecuteQueryDto,
  ) {
    return this.nl2sqlService.previewQuery(queryId, dto.sql);
  }

  @Post('feedback/:queryId')
  @ApiOperation({ summary: '쿼리 피드백 제출' })
  async feedback(
    @Param('queryId') queryId: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.nl2sqlService.feedback(queryId, dto.feedback, dto.note);
  }

  @Post('recommend/:dataSourceId')
  @ApiOperation({ summary: 'AI 추천 질문 생성' })
  async recommend(@Param('dataSourceId') dataSourceId: string) {
    return this.nl2sqlService.getRecommendedQuestions(dataSourceId);
  }

  @Post('simulate/:dataSourceId')
  @ApiOperation({ summary: 'AI SQL 생성 시뮬레이션 (상세 과정 반환)' })
  async simulate(
    @Param('dataSourceId') dataSourceId: string,
    @Body() body: { question: string },
  ) {
    return this.nl2sqlService.simulateQuery(dataSourceId, body.question);
  }
}
