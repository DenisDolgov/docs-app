import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DocumentAccessCache } from '../../src/permission/document-access-cache';
import { createTestingModule } from '../utils';

// Контракт куска S6: версионный кэш права. Проверяем ровно те свойства, на
// которых держится инвалидация: tri-state, версия в ключе, изоляция документов.
describe('DocumentAccessCache (integration)', () => {
  let cache: DocumentAccessCache;
  let close: () => Promise<void>;

  const principal = () => randomUUID();

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    cache = moduleRef.get(DocumentAccessCache);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('на промахе отдаёт undefined, а не null', async () => {
    const documentId = randomUUID();

    await expect(
      cache.get({ documentId, principalId: principal() }),
    ).resolves.toBeUndefined();
  });

  it('отдаёт ранее положенный уровень', async () => {
    const documentId = randomUUID();
    const principalId = principal();

    await cache.set({
      documentId,
      principal: { userId: principalId },
      level: 'editor',
    });

    await expect(cache.get({ documentId, principalId })).resolves.toBe(
      'editor',
    );
  });

  it('кэширует отказ: null — это значение, а не промах', async () => {
    const documentId = randomUUID();
    const principalId = principal();

    await cache.set({
      documentId,
      principal: { userId: principalId },
      level: null,
    });

    await expect(cache.get({ documentId, principalId })).resolves.toBeNull();
  });

  it('после инвалидации запись недостижима', async () => {
    const documentId = randomUUID();
    const principalId = principal();

    await cache.set({
      documentId,
      principal: { userId: principalId },
      level: 'viewer',
    });
    await cache.invalidate(documentId);

    await expect(
      cache.get({ documentId, principalId }),
    ).resolves.toBeUndefined();
  });

  it('инвалидация одного документа не сбрасывает другой', async () => {
    const first = randomUUID();
    const second = randomUUID();
    const principalId = principal();

    await cache.set({
      documentId: first,
      principal: { userId: principalId },
      level: 'editor',
    });
    await cache.set({
      documentId: second,
      principal: { userId: principalId },
      level: 'viewer',
    });

    await cache.invalidate(first);

    await expect(
      cache.get({ documentId: first, principalId }),
    ).resolves.toBeUndefined();
    await expect(cache.get({ documentId: second, principalId })).resolves.toBe(
      'viewer',
    );
  });

  it('права разных пользователей не смешиваются', async () => {
    const documentId = randomUUID();
    const granted = principal();
    const other = principal();

    await cache.set({
      documentId,
      principal: { userId: granted },
      level: 'commenter',
    });

    await expect(
      cache.get({ documentId, principalId: other }),
    ).resolves.toBeUndefined();
    await expect(cache.get({ documentId, principalId: granted })).resolves.toBe(
      'commenter',
    );
  });

  it('запись одного пользователя не сбрасывает запись другого', async () => {
    const documentId = randomUUID();
    const first = principal();
    const second = principal();

    await cache.set({
      documentId,
      principal: { userId: first },
      level: 'editor',
    });
    await cache.set({
      documentId,
      principal: { userId: second },
      level: 'viewer',
    });

    await expect(cache.get({ documentId, principalId: first })).resolves.toBe(
      'editor',
    );
    await expect(cache.get({ documentId, principalId: second })).resolves.toBe(
      'viewer',
    );
  });

  it('после инвалидации старые записи не возвращаются, даже когда кэш снова наполняется', async () => {
    const documentId = randomUUID();
    const first = principal();
    const second = principal();

    await cache.set({
      documentId,
      principal: { userId: first },
      level: 'editor',
    });
    await cache.invalidate(documentId);
    await expect(
      cache.get({ documentId, principalId: first }),
    ).resolves.toBeUndefined();

    await cache.set({
      documentId,
      principal: { userId: first },
      level: 'viewer',
    });
    await expect(cache.get({ documentId, principalId: first })).resolves.toBe(
      'viewer',
    );

    // Вторая инвалидация и новая запись другого пользователя не должны
    // «воскресить» ключ, который существовал до неё.
    await cache.invalidate(documentId);
    await cache.set({
      documentId,
      principal: { userId: second },
      level: 'editor',
    });

    await expect(
      cache.get({ documentId, principalId: first }),
    ).resolves.toBeUndefined();
    await expect(cache.get({ documentId, principalId: second })).resolves.toBe(
      'editor',
    );
  });
});
