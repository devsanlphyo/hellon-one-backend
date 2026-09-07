import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let errorType = 'InternalServerError';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, any>;
      message = resp.message || resp.error || message;
      errorType =
        resp.error ||
        (exception instanceof HttpException ? exception.name : 'InternalServerError');
    } else if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      errorType = exception instanceof HttpException ? exception.name : 'Error';
    } else if (exception instanceof Error) {
      message = exception.message;
      errorType = exception.name;
    }

    const errorLog = `[${request.method}] ${request.url} - Status: ${status} - Message: ${
      typeof message === 'object' ? JSON.stringify(message) : message
    } - IP: ${request.ip}`;

    if (status >= 500) {
      this.logger.error(
        errorLog,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(errorLog);
    }

    response.status(status).json({
      isSuccess: false,
      statusCode: status,
      error: errorType,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
