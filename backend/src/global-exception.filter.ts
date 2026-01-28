import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    // Check if it's a standard HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } 
    // Manual check for UnauthorizedException due to potential instance mismatches
    else if (
        (exception as any)?.name === 'UnauthorizedException' || 
        (exception as any)?.message === 'Unauthorized' ||
        (exception as any)?.status === 401
    ) {
      status = HttpStatus.UNAUTHORIZED;
      message = 'Unauthorized';
    }

    // Prepare response object
    const responseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'string' ? message : (message as any).message || message,
    };

    // Log error details
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} : ${status}`,
        (exception as Error).stack
      );
    } else {
        this.logger.warn(`[${request.method}] ${request.url} : ${status} - ${JSON.stringify(message)}`);
    }

    response.status(status).json(responseBody);
  }
}
