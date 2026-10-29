import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessPolicyService } from '../../src/permission/access-policy.service';
import { AccessResolver } from '../../src/permission/access-resolver';
import { DocumentAccessCache } from '../../src/permission/document-access-cache';

const USER_ID = '0192f5b0-1c00-7000-8000-000000000001';
const DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000020';

const resolver = {
  resolve: vi.fn(),
};

const cache = {
  get: vi.fn(),
  set: vi.fn(),
  invalidate: vi.fn(),
};

describe('AccessPolicyService (unit)', () => {
  let service: AccessPolicyService;

  const params = { documentId: DOCUMENT_ID, principal: { userId: USER_ID } };

  beforeEach(async () => {
    vi.clearAllMocks();
    cache.set.mockResolvedValue(undefined);
    cache.invalidate.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessPolicyService,
        { provide: AccessResolver, useValue: resolver },
        { provide: DocumentAccessCache, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(AccessPolicyService);
  });

  it('на промахе считает право резолвером и кладёт его в кэш', async () => {
    cache.get.mockResolvedValue(undefined);
    resolver.resolve.mockResolvedValue('editor');

    await expect(service.getDocumentAccess(params)).resolves.toBe('editor');

    expect(resolver.resolve).toHaveBeenCalledWith(params);
    expect(cache.set).toHaveBeenCalledWith({ ...params, level: 'editor' });
  });

  it('на попадании не зовёт резолвер', async () => {
    cache.get.mockResolvedValue('viewer');

    await expect(service.getDocumentAccess(params)).resolves.toBe('viewer');

    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('не путает отрицательный кэш с промахом', async () => {
    cache.get.mockResolvedValue(null);

    await expect(service.getDocumentAccess(params)).resolves.toBeNull();

    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('падение кэша не меняет решение: считает из источника истины', async () => {
    cache.get.mockRejectedValue(new Error('redis is down'));
    resolver.resolve.mockResolvedValue('owner');

    await expect(service.getDocumentAccess(params)).resolves.toBe('owner');
  });

  it('ошибка записи в кэш не отменяет уже посчитанное право', async () => {
    cache.get.mockResolvedValue(undefined);
    cache.set.mockRejectedValue(new Error('redis is down'));
    resolver.resolve.mockResolvedValue('viewer');

    await expect(service.getDocumentAccess(params)).resolves.toBe('viewer');
  });

  describe('assertDocumentAccess', () => {
    it('пропускает, если уровня хватает', async () => {
      cache.get.mockResolvedValue('editor');

      await expect(
        service.assertDocumentAccess({ ...params, required: 'commenter' }),
      ).resolves.toBe('editor');
    });

    it('отвечает 403, если документ виден, но уровня не хватает', async () => {
      cache.get.mockResolvedValue('viewer');

      await expect(
        service.assertDocumentAccess({ ...params, required: 'editor' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('отвечает 404, если доступа нет вовсе', async () => {
      cache.get.mockResolvedValue(null);

      await expect(
        service.assertDocumentAccess({ ...params, required: 'viewer' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('owner покрывает любое требование', async () => {
      cache.get.mockResolvedValue('owner');

      await expect(
        service.assertDocumentAccess({ ...params, required: 'owner' }),
      ).resolves.toBe('owner');
    });
  });

  describe('invalidateDocument', () => {
    it('сбрасывает кэш документа', async () => {
      await service.invalidateDocument(DOCUMENT_ID);

      expect(cache.invalidate).toHaveBeenCalledWith(DOCUMENT_ID);
    });

    it('не пробрасывает ошибку инвалидации: запись в БД уже состоялась', async () => {
      cache.invalidate.mockRejectedValue(new Error('redis is down'));

      await expect(
        service.invalidateDocument(DOCUMENT_ID),
      ).resolves.toBeUndefined();
    });
  });
});
