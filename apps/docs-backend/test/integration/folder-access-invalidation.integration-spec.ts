import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { DocumentService } from '../../src/document/document.service';
import { FolderService } from '../../src/document/folder.service';
import { OrganizationService } from '../../src/organization/organization.service';
import { DocumentAccessCache } from '../../src/permission/document-access-cache';
import { FolderShareService } from '../../src/permission/folder-share.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

// Кусок S6. Тесты смотрят на сам кэш, а не на право: так они проверяют
// инвалидацию поддерева, не завися от наследования из S14.
describe('folder access invalidation (integration)', () => {
  let auth: AuthService;
  let users: UserRepository;
  let organizations: OrganizationService;
  let documents: DocumentService;
  let folders: FolderService;
  let folderShares: FolderShareService;
  let cache: DocumentAccessCache;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });
    await users.markEmailVerified(user.id);

    return { email, id: user.id };
  };

  const setupOrganization = async () => {
    const owner = await register();
    const organization = await organizations.create({
      userId: owner.id,
      name: 'Acme',
    });

    return { owner, organization };
  };

  const createFolder = async (
    organizationId: string,
    actorId: string,
    name: string,
    parentId: string | null = null,
  ) => {
    return folders.create({ organizationId, actorId, name, parentId });
  };

  const createDocumentInFolder = async (
    organizationId: string,
    actorId: string,
    folderId: string,
  ) => {
    const document = await documents.createInOrganization({
      organizationId,
      actorId,
      title: 'Заметки',
    });

    return documents.update({
      documentId: document.id,
      actorId,
      folderId,
    });
  };

  // Ключ кэша не требует существующего пользователя: проверяем только то, что
  // запись по этому ключу исчезла после операции с папкой.
  const primeCache = async (documentId: string, userId: string) => {
    await cache.set({
      documentId,
      principal: { userId },
      level: 'viewer',
    });

    await expect(cache.get({ documentId, principalId: userId })).resolves.toBe(
      'viewer',
    );
  };

  const expectCacheCleared = async (documentId: string, userId: string) => {
    await expect(
      cache.get({ documentId, principalId: userId }),
    ).resolves.toBeUndefined();
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    users = moduleRef.get(UserRepository);
    organizations = moduleRef.get(OrganizationService);
    documents = moduleRef.get(DocumentService);
    folders = moduleRef.get(FolderService);
    folderShares = moduleRef.get(FolderShareService);
    cache = moduleRef.get(DocumentAccessCache);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('share на корневой папке сбрасывает документы всего поддерева', async () => {
    const { owner, organization } = await setupOrganization();
    const root = await createFolder(organization.id, owner.id, 'Проекты');
    const child = await createFolder(
      organization.id,
      owner.id,
      'Архив',
      root.id,
    );
    const direct = await createDocumentInFolder(
      organization.id,
      owner.id,
      root.id,
    );
    const nested = await createDocumentInFolder(
      organization.id,
      owner.id,
      child.id,
    );
    const reader = randomUUID();

    await primeCache(direct.id, reader);
    await primeCache(nested.id, reader);

    await folderShares.grant({
      folderId: root.id,
      userId: reader,
      role: 'viewer',
      actorId: owner.id,
    });

    await expectCacheCleared(direct.id, reader);
    await expectCacheCleared(nested.id, reader);
  });

  it('отзыв share на папке сбрасывает документы поддерева', async () => {
    const { owner, organization } = await setupOrganization();
    const root = await createFolder(organization.id, owner.id, 'Проекты');
    const child = await createFolder(
      organization.id,
      owner.id,
      'Черновики',
      root.id,
    );
    const document = await createDocumentInFolder(
      organization.id,
      owner.id,
      child.id,
    );
    const reader = randomUUID();

    await folderShares.grant({
      folderId: root.id,
      userId: reader,
      role: 'editor',
      actorId: owner.id,
    });
    await primeCache(document.id, reader);

    await folderShares.revoke({
      folderId: root.id,
      userId: reader,
      actorId: owner.id,
    });

    await expectCacheCleared(document.id, reader);
  });

  it('переезд папки сбрасывает документы её поддерева', async () => {
    const { owner, organization } = await setupOrganization();
    const shared = await createFolder(organization.id, owner.id, 'Общая');
    const moving = await createFolder(organization.id, owner.id, 'Проект');
    const nested = await createFolder(
      organization.id,
      owner.id,
      'Вложенная',
      moving.id,
    );
    const document = await createDocumentInFolder(
      organization.id,
      owner.id,
      nested.id,
    );
    const reader = randomUUID();

    await primeCache(document.id, reader);

    await folders.update({
      folderId: moving.id,
      actorId: owner.id,
      parentId: shared.id,
    });

    await expectCacheCleared(document.id, reader);
  });
});
