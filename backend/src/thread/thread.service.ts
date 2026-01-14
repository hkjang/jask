import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageRole } from '@prisma/client';

@Injectable()
export class ThreadService {
  constructor(private prisma: PrismaService) {}

  async createThread(userId: string, title?: string) {
    return this.prisma.thread.create({
      data: {
        ownerId: userId,
        title: title || 'New Conversation',
        users: {
          create: {
            userId: userId,
            isPinned: false,
          },
        },
      },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          take: 1,
        },
      },
    });
  }

  async getUserThreads(userId: string, query?: string) {
    return this.prisma.thread.findMany({
      where: {
        ownerId: userId,
        status: 'ACTIVE',
        ...(query ? {
            OR: [
                { title: { contains: query, mode: 'insensitive' } },
                // Optional: search in messages content too if performance allows
                // { messages: { some: { content: { contains: query, mode: 'insensitive' } } } }
            ]
        } : {})
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  async getThread(threadId: string, userId: string) {
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          include: { query: true },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (thread.ownerId !== userId) {
      // Check if shared? For now strict ownership
      throw new ForbiddenException('Access denied');
    }

    return thread;
  }

  async addMessage(threadId: string, role: MessageRole, content: string) {
    // 1. Create message
    const message = await this.prisma.message.create({
      data: {
        threadId,
        role,
        content,
      },
    });

    // 2. Update thread timestamp
    await this.prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async deleteThread(threadId: string, userId: string) {
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
    });

    if (!thread) throw new NotFoundException('Thread not found');
    if (thread.ownerId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.thread.delete({
      where: { id: threadId },
    });
  }

  async getDefaultUserId() {
    const user = await this.prisma.user.findFirst();
    return user?.id || '';
  }
}
