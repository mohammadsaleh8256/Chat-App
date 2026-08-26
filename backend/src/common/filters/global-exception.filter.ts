import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ApiErrorResponse {
  error: string;
  message: string;
  detail?: string;
  traceId?: string;
  code?: string;
  statusCode: number;
  validationErrors?: Record<string, string[]>;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = (request.headers['x-request-id'] as string) || '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'خطای داخلی سرور رخ داد.';
    let detail: string | undefined;
    let validationErrors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === 'object' && r !== null) {
        const resp = r as Record<string, any>;
        message = resp.message
          ? Array.isArray(resp.message)
            ? resp.message.join(' • ')
            : String(resp.message)
          : message;
        code = resp.code || resp.error || exception.name;
        validationErrors = resp.errors;
        detail = resp.detail;
      } else {
        message = String(r);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          code = 'CONFLICT';
          message = 'مقدار تکراری است.';
          {
            const target = (exception.meta?.target as string[]) || [];
            if (target.length) message = `مقدار «${target.join(', ')}» تکراری است.`;
          }
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          code = 'NOT_FOUND';
          message = 'موجودیت یافت نشد.';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          code = 'DATABASE_ERROR';
          message = `خطای پایگاه داده: ${exception.code}`;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'خطای اعتبارسنجی داده.';
      detail = exception.message;
    } else if (exception instanceof Error) {
      const m = exception.message.toLowerCase();
      if (m.includes('not found') || m.includes('یافت نشد')) {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
      } else if (m.includes('unauthorized') || m.includes('اجازه') || m.includes('forbidden')) {
        status = HttpStatus.FORBIDDEN;
        code = 'FORBIDDEN';
      } else if (m.includes('invalid') || m.includes('نامعتبر')) {
        status = HttpStatus.BAD_REQUEST;
        code = 'BAD_REQUEST';
      }
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? `${exception.message}\n${exception.stack}` : exception);
    } else {
      this.logger.warn(`${code}: ${message} (traceId=${traceId})`);
    }

    const payload: ApiErrorResponse = {
      error: code,
      message,
      detail,
      traceId,
      code,
      statusCode: status,
      validationErrors,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (!response.headersSent) {
      response.status(status).json(payload);
    }
  }
}
