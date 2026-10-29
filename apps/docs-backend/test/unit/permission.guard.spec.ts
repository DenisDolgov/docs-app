import { type ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationException } from '../../src/common/validation.exception';
import { AccessPolicyService } from '../../src/permission/access-policy.service';
import { PermissionGuard } from '../../src/permission/permission.guard';

const USER_ID = '0192f5b0-1c00-7000-8000-000000000001';
const DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000020';

const accessPolicy = {
  assertDocumentAccess: vi.fn(),
};

const reflector = {
  getAllAndOverride: vi.fn(),
};

const contextFor = (request: unknown) =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const requestFor = (documentId: string, withUser = true) => ({
  params: { documentId },
  user: withUser ? { sub: USER_ID, email: 'user@example.com' } : undefined,
});

describe('PermissionGuard (unit)', () => {
  let guard: PermissionGuard;

  beforeEach(async () => {
    vi.clearAllMocks();
    accessPolicy.assertDocumentAccess.mockResolvedValue('viewer');

    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        { provide: Reflector, useValue: reflector },
        { provide: AccessPolicyService, useValue: accessPolicy },
      ],
    }).compile();

    guard = moduleRef.get(PermissionGuard);
  });

  it('пропускает хендлер без @RequirePermission', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      guard.canActivate(contextFor(requestFor(DOCUMENT_ID))),
    ).resolves.toBe(true);

    expect(accessPolicy.assertDocumentAccess).not.toHaveBeenCalled();
  });

  it('спрашивает политику с уровнем из метаданных', async () => {
    reflector.getAllAndOverride.mockReturnValue('editor');

    await expect(
      guard.canActivate(contextFor(requestFor(DOCUMENT_ID))),
    ).resolves.toBe(true);

    expect(accessPolicy.assertDocumentAccess).toHaveBeenCalledWith({
      documentId: DOCUMENT_ID,
      principal: { userId: USER_ID },
      required: 'editor',
    });
  });

  it('пробрасывает 404 от политики', async () => {
    reflector.getAllAndOverride.mockReturnValue('viewer');
    accessPolicy.assertDocumentAccess.mockRejectedValue(
      new NotFoundException(),
    );

    await expect(
      guard.canActivate(contextFor(requestFor(DOCUMENT_ID))),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('отвечает 400 на невалидный documentId, не доходя до БД', async () => {
    reflector.getAllAndOverride.mockReturnValue('viewer');

    await expect(
      guard.canActivate(contextFor(requestFor('not-a-uuid'))),
    ).rejects.toBeInstanceOf(ValidationException);

    expect(accessPolicy.assertDocumentAccess).not.toHaveBeenCalled();
  });

  it('не пускает запрос без пользователя', async () => {
    reflector.getAllAndOverride.mockReturnValue('viewer');

    await expect(
      guard.canActivate(contextFor(requestFor(DOCUMENT_ID, false))),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
