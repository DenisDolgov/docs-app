import { STATUS_CODES } from 'node:http';
import type { ProblemDetails } from '@docs-app/contracts/http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { ValidationException } from './validation.exception';

const ABOUT_BLANK = 'about:blank';

const statusTitle = (status: number): string => STATUS_CODES[status] ?? 'Error';

// Единый конверт ошибок RFC 9457 (problem+json). `title` — фраза HTTP-статуса,
// конкретика — в `detail`, полевые ошибки валидации — в `errors`.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // WS и прочие контексты штатно обрабатываются своим адаптером.
      this.logger.error(exception);
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const problem = this.toProblemDetails(exception, request.url);

    if (problem.status >= 500) {
      this.logger.error(
        { err: exception, status: problem.status, path: request.url },
        'unhandled exception',
      );
    }

    response
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblemDetails(
    exception: unknown,
    instance: string,
  ): ProblemDetails {
    if (exception instanceof ValidationException) {
      const status = exception.getStatus();

      return {
        type: ABOUT_BLANK,
        title: statusTitle(status),
        status,
        detail: 'Validation failed',
        instance,
        errors: exception.issues,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const detail = this.detailFromException(exception);

      return {
        type: ABOUT_BLANK,
        title: statusTitle(status),
        status,
        ...(detail ? { detail } : {}),
        instance,
      };
    }

    return {
      type: ABOUT_BLANK,
      title: statusTitle(500),
      status: 500,
      detail: 'Internal server error',
      instance,
    };
  }

  private detailFromException(exception: HttpException): string | undefined {
    const body = exception.getResponse();

    if (typeof body === 'string') return body;

    if (body && typeof body === 'object') {
      const { message } = body as { message?: unknown };

      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join('; ');
    }

    return undefined;
  }
}
