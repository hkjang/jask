import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ThreadService } from './thread.service';
// Assuming JwtAuthGuard exists in auth module or common guard
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessageRole } from '@prisma/client';

@Controller('threads')
// @UseGuards(JwtAuthGuard) // Uncomment if auth is ready and required globally or per route
export class ThreadController {
  constructor(private readonly threadService: ThreadService) {}

  @Post()
  async createThread(@Body() body: { title?: string }, @Request() req: any) {
    let userId = req.user?.id;
    if (!userId) {
       userId = await this.threadService.getDefaultUserId();
    }
    return this.threadService.createThread(userId, body.title);
  }

  @Get()
  async getThreads(@Request() req: any, @Query('q') query?: string) {
    let userId = req.user?.id;
    if (!userId) userId = await this.threadService.getDefaultUserId();
    return this.threadService.getUserThreads(userId, query);
  }

  @Get(':id')
  async getThread(@Param('id') id: string, @Request() req: any) {
    let userId = req.user?.id;
    if (!userId) userId = await this.threadService.getDefaultUserId();
    return this.threadService.getThread(id, userId);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() body: { role: MessageRole; content: string }
  ) {
    return this.threadService.addMessage(id, body.role, body.content);
  }

  @Delete(':id')
  async deleteThread(@Param('id') id: string, @Request() req: any) {
    let userId = req.user?.id;
    if (!userId) userId = await this.threadService.getDefaultUserId();
    return this.threadService.deleteThread(id, userId);
  }
}
