import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { QueryService } from './query.service';

@ApiTags('Query')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Get('history')
  @ApiOperation({ summary: '쿼리 히스토리 조회' })
  getHistory(
    @Request() req: any,
    @Query('dataSourceId') dataSourceId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.queryService.getHistory({
      userId: req.user.id,
      dataSourceId,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('history/:id')
  @ApiOperation({ summary: '쿼리 상세 조회' })
  getQueryById(@Param('id') id: string) {
    return this.queryService.getQueryById(id);
  }

  @Get('favorites')
  @ApiOperation({ summary: '즐겨찾기 목록 조회' })
  getFavorites(@Request() req: any) {
    return this.queryService.getFavorites(req.user.id);
  }

  @Post('favorites')
  @ApiOperation({ summary: '즐겨찾기 추가' })
  addFavorite(
    @Request() req: any,
    @Body() body: { name: string; naturalQuery: string; sqlQuery: string; dataSourceId?: string },
  ) {
    return this.queryService.addFavorite(req.user.id, body);
  }

  @Delete('favorites/:id')
  @ApiOperation({ summary: '즐겨찾기 삭제' })
  removeFavorite(@Request() req: any, @Param('id') id: string) {
    return this.queryService.removeFavorite(req.user.id, id);
  }

  @Get('stats')
  @ApiOperation({ summary: '사용 통계' })
  getStats(@Request() req: any) {
    return this.queryService.getStats(req.user.id);
  }
  @Post(':id/comments')
  @ApiOperation({ summary: '댓글 작성' })
  addComment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.queryService.addComment(req.user.id, id, body.content);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: '댓글 목록 조회' })
  getComments(@Param('id') id: string) {
    return this.queryService.getComments(id);
  }

  @Post(':id/share')
  @ApiOperation({ summary: '쿼리 공유' })
  shareQuery(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { sharedToUserId?: string; sharedToTeam?: string; isPublic?: boolean },
  ) {
    return this.queryService.shareQuery(req.user.id, id, body);
  }

  @Get(':id/shares')
  @ApiOperation({ summary: '공유 현황 조회' })
  getShares(@Param('id') id: string) {
    return this.queryService.getShares(id);
  }
  @Post(':id/feedback')
  @ApiOperation({ summary: '피드백 등록' })
  addFeedback(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { feedback: 'POSITIVE' | 'NEGATIVE'; note?: string },
  ) {
    return this.queryService.addFeedback(req.user.id, id, body.feedback, body.note);
  }
}
