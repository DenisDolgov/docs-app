import { randomUUID } from 'node:crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { DocumentService } from '../../src/document/document.service';
import { FolderService } from '../../src/document/folder.service';
import { OrganizationService } from '../../src/organization/organization.service';
import { DocumentShareService } from '../../src/permission/document-share.service';
import { FolderShareService } from '../../src/permission/folder-share.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('folder permissions (integration)', () => {
  let auth: AuthService;
  let users: UserRepository;
  let organizations: OrganizationService;
  let documents: DocumentService;
  let documentShares: DocumentShareService;
  let folders: FolderService;
  let folderShares: FolderShareService;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });
    await users.markEmailVerified(user.id);

    return { email, id: user.id };
  };

  const setup = async () => {
    const owner = await register();
    const organization = await organizations.create({
      userId: owner.id,
      name: 'Acme',
    });
    const root = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Проекты',
      parentId: null,
    });
    const child = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Архив',
      parentId: root.id,
    });
    const document = await documents.createInOrganization({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Заметки',
    });

    await documents.update({
      documentId: document.id,
      actorId: owner.id,
      folderId: child.id,
    });

    return { owner, organization, root, child, document };
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    users = moduleRef.get(UserRepository);
    organizations = moduleRef.get(OrganizationService);
    documents = moduleRef.get(DocumentService);
    documentShares = moduleRef.get(DocumentShareService);
    folders = moduleRef.get(FolderService);
    folderShares = moduleRef.get(FolderShareService);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('viewer папки читает документ из вложенной папки', async () => {
    const { owner, root, document } = await setup();
    const viewer = await register();

    await folderShares.grant({
      folderId: root.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    await expect(
      documents.get({ documentId: document.id, actorId: viewer.id }),
    ).resolves.toMatchObject({ id: document.id });
  });

  it('viewer папки не правит документ', async () => {
    const { owner, root, document } = await setup();
    const viewer = await register();

    await folderShares.grant({
      folderId: root.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    await expect(
      documents.update({
        documentId: document.id,
        actorId: viewer.id,
        title: 'Правка',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('editor папки правит документ', async () => {
    const { owner, root, document } = await setup();
    const editor = await register();

    await folderShares.grant({
      folderId: root.id,
      userId: editor.id,
      role: 'editor',
      actorId: owner.id,
    });

    const updated = await documents.update({
      documentId: document.id,
      actorId: editor.id,
      title: 'Правка',
    });

    expect(updated.title).toBe('Правка');
  });

  it('прямой share складывается с правом папки по максимуму', async () => {
    const { owner, root, document } = await setup();
    const member = await register();

    await folderShares.grant({
      folderId: root.id,
      userId: member.id,
      role: 'viewer',
      actorId: owner.id,
    });
    await documentShares.grant({
      documentId: document.id,
      userId: member.id,
      role: 'editor',
      actorId: owner.id,
    });

    await expect(
      documents.update({
        documentId: document.id,
        actorId: member.id,
        title: 'Правка',
      }),
    ).resolves.toMatchObject({ title: 'Правка' });
  });

  it('документ из поддерева попадает в список доступных', async () => {
    const { owner, root, document } = await setup();
    const viewer = await register();

    await folderShares.grant({
      folderId: root.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    const available = await documents.listAccessible({ actorId: viewer.id });

    expect(available.map((item) => item.id)).toContain(document.id);
  });

  it('чужак без share не видит документ', async () => {
    const { document } = await setup();
    const outsider = await register();

    await expect(
      documents.get({ documentId: document.id, actorId: outsider.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('переезд документа под shared-папку меняет право', async () => {
    const { owner, root, document } = await setup();
    const viewer = await register();

    await folderShares.grant({
      folderId: root.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    // Переносим документ из вложенной папки на верхний уровень организации.
    await documents.update({
      documentId: document.id,
      actorId: owner.id,
      folderId: null,
    });

    await expect(
      documents.get({ documentId: document.id, actorId: viewer.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('viewer папки не управляет её share', async () => {
    const { owner, root } = await setup();
    const viewer = await register();

    await folderShares.grant({
      folderId: root.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    await expect(
      folderShares.grant({
        folderId: root.id,
        userId: viewer.id,
        role: 'editor',
        actorId: viewer.id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('viewer папки не переименовывает и не удаляет её', async () => {
    const { owner, root } = await setup();
    const viewer = await register();

    await folderShares.grant({
      folderId: root.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    await expect(
      folders.update({
        folderId: root.id,
        actorId: viewer.id,
        name: 'Чужое имя',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      folders.remove({ folderId: root.id, actorId: viewer.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
