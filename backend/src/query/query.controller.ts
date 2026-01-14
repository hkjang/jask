import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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

  // ===========================================
  // 즐겨찾기
  // ===========================================
  
  @Get('favorites')
  @ApiOperation({ summary: '즐겨찾기 목록 조회' })
  getFavorites(
    @Request() req: any,
    @Query('folderId') folderId?: string,
    @Query('tag') tag?: string,
    @Query('dataSourceId') dataSourceId?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'useCount' | 'name' | 'displayOrder',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.queryService.getFavorites(req.user.id, { folderId, tag, dataSourceId, sortBy, sortOrder });
  }

  @Get('favorites/stats')
  @ApiOperation({ summary: '즐겨찾기 통계' })
  getFavoriteStats(@Request() req: any) {
    return this.queryService.getFavoriteStats(req.user.id);
  }

  @Get('favorites/folders')
  @ApiOperation({ summary: '즐겨찾기 폴더 목록 조회' })
  getFavoriteFolders(@Request() req: any) {
    return this.queryService.getFavoriteFolders(req.user.id);
  }

  @Post('favorites/folders')
  @ApiOperation({ summary: '즐겨찾기 폴더 생성' })
  createFavoriteFolder(
    @Request() req: any,
    @Body() body: { name: string; color?: string; icon?: string },
  ) {
    return this.queryService.createFavoriteFolder(req.user.id, body);
  }

  @Put('favorites/folders/:id')
  @ApiOperation({ summary: '즐겨찾기 폴더 수정' })
  updateFavoriteFolder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string; icon?: string; displayOrder?: number },
  ) {
    return this.queryService.updateFavoriteFolder(req.user.id, id, body);
  }

  @Delete('favorites/folders/:id')
  @ApiOperation({ summary: '즐겨찾기 폴더 삭제' })
  deleteFavoriteFolder(@Request() req: any, @Param('id') id: string) {
    return this.queryService.deleteFavoriteFolder(req.user.id, id);
  }

  @Post('favorites')
  @ApiOperation({ summary: '즐겨찾기 추가' })
  addFavorite(
    @Request() req: any,
    @Body() body: { 
      name: string; 
      naturalQuery: string; 
      sqlQuery: string; 
      dataSourceId?: string;
      folderId?: string;
      tags?: string[];
      description?: string;
    },
  ) {
    return this.queryService.addFavorite(req.user.id, body);
  }

  @Put('favorites/:id')
  @ApiOperation({ summary: '즐겨찾기 수정' })
  updateFavorite(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { 
      name?: string; 
      folderId?: string | null;
      tags?: string[];
      description?: string;
      displayOrder?: number;
    },
  ) {
    return this.queryService.updateFavorite(req.user.id, id, body);
  }

  @Patch('favorites/:id/use')
  @ApiOperation({ summary: '즐겨찾기 사용 횟수 증가' })
  incrementFavoriteUseCount(@Request() req: any, @Param('id') id: string) {
    return this.queryService.incrementFavoriteUseCount(req.user.id, id);
  }

  @Put('favorites/reorder')
  @ApiOperation({ summary: '즐겨찾기 순서 변경' })
  reorderFavorites(
    @Request() req: any,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.queryService.reorderFavorites(req.user.id, body.orderedIds);
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
