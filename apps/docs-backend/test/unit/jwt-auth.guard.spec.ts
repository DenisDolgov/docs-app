import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard';

const jwtService = {
  verifyAsync: vi.fn(),
};

const contextFor = (authorization?: string) => {
  const request: { headers: { authorization?: string }; user?: unknown } = {
    headers: { authorization },
  };

  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
    request,
  };
};

describe('JwtAuthGuard (unit)', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [JwtAuthGuard, { provide: JwtService, useValue: jwtService }],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
  });

  it('отвечает 401 без заголовка Authorization', async () => {
    const { context } = contextFor();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('отвечает 401 на схему, отличную от Bearer', async () => {
    const { context } = contextFor('Basic dXNlcjpwYXNz');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('пропускает запрос и кладёт payload в request.user', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
    });
    const { context, request } = contextFor('Bearer valid.token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid.token');
    expect(request.user).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
    });
  });

  it('отвечает 401, если проверка подписи падает', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const { context } = contextFor('Bearer broken.token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
