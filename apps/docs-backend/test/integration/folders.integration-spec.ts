import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { DocumentService } from '../../src/document/document.service';
import { FolderService } from '../../src/document/folder.service';
import { OrganizationService } from '../../src/organization/organization.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('folders (integration)', () => {
  let auth: AuthService;
  let users: UserRepository;
  let organizations: OrganizationService;
  let documents: DocumentService;
  let folders: FolderService;
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

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    users = moduleRef.get(UserRepository);
    organizations = moduleRef.get(OrganizationService);
    documents = moduleRef.get(DocumentService);
    folders = moduleRef.get(FolderService);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('строит дерево из корневых и вложенных папок', async () => {
    const { owner, organization } = await setupOrganization();
    const projects = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Проекты',
      parentId: null,
    });
    const archive = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Архив',
      parentId: null,
    });
    const nested = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: '2026',
      parentId: projects.id,
    });

    const tree = await folders.listTree({
      organizationId: organization.id,
      actorId: owner.id,
    });

    expect(tree.map((node) => node.name)).toEqual(['Архив', 'Проекты']);
    expect(tree[1]?.children.map((node) => node.id)).toEqual([nested.id]);
    expect(tree[0]?.id).toBe(archive.id);
  });

  it('переименовывает и перемещает папку', async () => {
    const { owner, organization } = await setupOrganization();
    const target = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Цель',
      parentId: null,
    });
    const moving = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Старое имя',
      parentId: null,
    });

    const updated = await folders.update({
      folderId: moving.id,
      actorId: owner.id,
      name: 'Новое имя',
      parentId: target.id,
    });

    expect(updated).toMatchObject({
      id: moving.id,
      name: 'Новое имя',
      parentId: target.id,
    });
  });

  it('запрещает переместить папку в себя', async () => {
    const { owner, organization } = await setupOrganization();
    const folder = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Проект',
      parentId: null,
    });

    await expect(
      folders.update({
        folderId: folder.id,
        actorId: owner.id,
        parentId: folder.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('запрещает переместить папку в собственного потомка', async () => {
    const { owner, organization } = await setupOrganization();
    const root = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Корень',
      parentId: null,
    });
    const child = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Ребёнок',
      parentId: root.id,
    });
    const grandchild = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Внук',
      parentId: child.id,
    });

    await expect(
      folders.update({
        folderId: root.id,
        actorId: owner.id,
        parentId: grandchild.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('сериализует встречные перемещения локом организации', async () => {
    const { owner, organization } = await setupOrganization();
    const left = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Левая',
      parentId: null,
    });
    const right = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Правая',
      parentId: null,
    });

    // Держим лок организации в отдельной транзакции: проверка цикла и запись
    // должны ждать его, иначе два встречных перемещения проходят проверку
    // одновременно и создают цикл.
    const blocker = new Client({ connectionString: process.env.DATABASE_URL });
    await blocker.connect();
    await blocker.query('begin');
    await blocker.query('select pg_advisory_xact_lock(hashtext($1))', [
      organization.id,
    ]);

    const move = folders.update({
      folderId: left.id,
      actorId: owner.id,
      parentId: right.id,
    });

    let settled = false;
    void move.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(settled).toBe(false);

    await blocker.query('commit');
    await blocker.end();

    await expect(move).resolves.toMatchObject({ parentId: right.id });
  });

  it('удаляет только пустую папку', async () => {
    const { owner, organization } = await setupOrganization();
    const root = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Корень',
      parentId: null,
    });
    const child = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Ребёнок',
      parentId: root.id,
    });

    await expect(
      folders.remove({ folderId: root.id, actorId: owner.id }),
    ).rejects.toBeInstanceOf(ConflictException);

    await folders.remove({ folderId: child.id, actorId: owner.id });
    await expect(
      folders.remove({ folderId: root.id, actorId: owner.id }),
    ).resolves.toBeUndefined();
  });

  it('не удаляет папку с документом', async () => {
    const { owner, organization } = await setupOrganization();
    const folder = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'С документами',
      parentId: null,
    });
    const document = await documents.createInOrganization({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Заметки',
    });

    await documents.update({
      documentId: document.id,
      actorId: owner.id,
      folderId: folder.id,
    });

    await expect(
      folders.remove({ folderId: folder.id, actorId: owner.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('переносит документ в папку своей организации', async () => {
    const { owner, organization } = await setupOrganization();
    const folder = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Проекты',
      parentId: null,
    });
    const document = await documents.createInOrganization({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Заметки',
    });

    const updated = await documents.update({
      documentId: document.id,
      actorId: owner.id,
      folderId: folder.id,
    });

    expect(updated.folderId).toBe(folder.id);
  });

  it('не пускает личный документ в папку', async () => {
    const { owner, organization } = await setupOrganization();
    const folder = await folders.create({
      organizationId: organization.id,
      actorId: owner.id,
      name: 'Проекты',
      parentId: null,
    });
    const personal = await documents.createPersonal({
      actorId: owner.id,
      title: 'Личное',
    });

    await expect(
      documents.update({
        documentId: personal.id,
        actorId: owner.id,
        folderId: folder.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('не пускает документ в папку чужой организации', async () => {
    const { owner, organization } = await setupOrganization();
    const other = await organizations.create({
      userId: owner.id,
      name: 'Другая',
    });
    const foreignFolder = await folders.create({
      organizationId: other.id,
      actorId: owner.id,
      name: 'Чужая',
      parentId: null,
    });
    const document = await documents.createInOrganization({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Заметки',
    });

    await expect(
      documents.update({
        documentId: document.id,
        actorId: owner.id,
        folderId: foreignFolder.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
