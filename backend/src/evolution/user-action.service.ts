import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionType, Prisma } from '@prisma/client';

@Injectable()
export class UserActionService {
  private readonly logger = new Logger(UserActionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(userId: string, actionType: ActionType, queryId?: string, payload?: any) {
    try {
      return await this.prisma.userActionLog.create({
        data: {
          userId,
          actionType,
          queryId,
          payload: payload ? (payload as Prisma.InputJsonValue) : undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log user action: ${error.message}`, error.stack);
      // We don't want to block the main flow if logging fails
      return null;
    }
  }

  async getUserActions(userId: string, limit = 50) {
    return this.prisma.userActionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
