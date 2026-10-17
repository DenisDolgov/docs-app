import type { ArgumentsHost } from '@nestjs/common';
import { Logger, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter';
import { ValidationException } from '../../src/common/validation.exception';

const createHost = (url = '/x') => {
  const response = {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };

  return {
    response,
    host: {
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url }),
      }),
    } as unknown as ArgumentsHost,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AllExceptionsFilter', () => {
  it('HttpException → problem+json с detail и фразой статуса', () => {
    const { host, response } = createHost();
    new AllExceptionsFilter().catch(
      new NotFoundException('Document not found'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(response.json).toHaveBeenCalledWith({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Document not found',
      instance: '/x',
    });
  });

  it('ValidationException → 400 с полем errors', () => {
    const { host, response } = createHost('/auth/register');
    const issues = [{ path: ['email'], message: 'Invalid email' }];

    new AllExceptionsFilter().catch(new ValidationException(issues), host);

    expect(response.json).toHaveBeenCalledWith({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Validation failed',
      instance: '/auth/register',
      errors: issues,
    });
  });

  it('непредвиденная ошибка → 500 без утечки внутренностей', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const { host, response } = createHost();

    new AllExceptionsFilter().catch(
      new Error('connection refused: secret'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'Internal server error',
      instance: '/x',
    });
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      'secret',
    );
  });

  it('не-HTTP контекст не трогает HTTP-ответ', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const response = { status: vi.fn(), type: vi.fn(), json: vi.fn() };
    const host = {
      getType: () => 'ws',
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({}),
      }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(new Error('boom'), host);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
