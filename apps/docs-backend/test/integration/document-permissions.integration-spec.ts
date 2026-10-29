import { randomUUID } from 'node:crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { DocumentService } from '../../src/document/document.service';
import { OrganizationService } from '../../src/organization/organization.service';
import { DocumentShareService } from '../../src/permission/document-share.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('document permissions (integration)', () => {
  let auth: AuthService;
  let users: UserRepository;
  let organizations: OrganizationService;
  let documents: DocumentService;
  let shares: DocumentShareService;
  let db: Database;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    await users.markEmailVerified(user.id);

    return { email, id: user.id };
  };

  const createOrganization = (userId: string) =>
    organizations.create({ userId, name: 'Acme' });

  const addOrganizationMember = (organizationId: string, ownerId: string) =>
    register().then(async (member) => {
      await organizations.addMember({
        organizationId,
        actorId: ownerId,
        email: member.email,
        role: 'member',
      });

      return member;
    });

  // Сценарий «документ организации»: владелец — он же owner организации.
  const setupOrganizationDocument = async () => {
    const owner = await register();
    const organization = await createOrganization(owner.id);
    const document = await documents.createInOrganization({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Заметки',
    });

    return { owner, organization, document };
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    users = moduleRef.get(UserRepository);
    organizations = moduleRef.get(OrganizationService);
    documents = moduleRef.get(DocumentService);
    shares = moduleRef.get(DocumentShareService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('участник организации читает и правит документ', async () => {
    const { owner, organization, document } = await setupOrganizationDocument();
    const member = await addOrganizationMember(organization.id, owner.id);

    await expect(
      documents.get({ documentId: document.id, actorId: member.id }),
    ).resolves.toMatchObject({ id: document.id });

    await expect(
      documents.update({
        documentId: document.id,
        actorId: member.id,
        title: 'Правка участника',
      }),
    ).resolves.toMatchObject({ title: 'Правка участника' });
  });

  it('share viewer читает, но не пишет', async () => {
    const { owner, document } = await setupOrganizationDocument();
    const viewer = await register();

    await shares.grant({
      documentId: document.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    await expect(
      documents.get({ documentId: document.id, actorId: viewer.id }),
    ).resolves.toMatchObject({ id: document.id });

    await expect(
      documents.update({
        documentId: document.id,
        actorId: viewer.id,
        title: 'Нельзя',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      documents.remove({ documentId: document.id, actorId: viewer.id }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('share commenter читает и комментирует, но не правит текст', async () => {
    const { owner, document } = await setupOrganizationDocument();
    const commenter = await register();

    await shares.grant({
      documentId: document.id,
      userId: commenter.id,
      role: 'commenter',
      actorId: owner.id,
    });

    await expect(
      documents.get({ documentId: document.id, actorId: commenter.id }),
    ).resolves.toMatchObject({ id: document.id });

    await expect(
      documents.update({
        documentId: document.id,
        actorId: commenter.id,
        title: 'Нельзя',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('share editor правит документ', async () => {
    const { owner, document } = await setupOrganizationDocument();
    const editor = await register();

    await shares.grant({
      documentId: document.id,
      userId: editor.id,
      role: 'editor',
      actorId: owner.id,
    });

    await expect(
      documents.update({
        documentId: document.id,
        actorId: editor.id,
        title: 'Правка редактора',
      }),
    ).resolves.toMatchObject({ title: 'Правка редактора' });
  });

  it('share работает и на личном документе', async () => {
    const owner = await register();
    const document = await documents.createPersonal({
      actorId: owner.id,
      title: 'Личное',
    });
    const viewer = await register();

    await shares.grant({
      documentId: document.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    await expect(
      documents.get({ documentId: document.id, actorId: viewer.id }),
    ).resolves.toMatchObject({ id: document.id });
  });

  it('чужой без share получает 404 на чтение', async () => {
    const { document } = await setupOrganizationDocument();
    const outsider = await register();

    await expect(
      documents.get({ documentId: document.id, actorId: outsider.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('повторный grant меняет роль на той же строке', async () => {
    const { owner, document } = await setupOrganizationDocument();
    const viewer = await register();

    await shares.grant({
      documentId: document.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });
    await shares.grant({
      documentId: document.id,
      userId: viewer.id,
      role: 'editor',
      actorId: owner.id,
    });

    const granted = await shares.list({
      documentId: document.id,
      actorId: owner.id,
    });

    expect(granted).toHaveLength(1);
    expect(granted[0]).toMatchObject({ userId: viewer.id, role: 'editor' });
  });

  it('отзыв share действует на следующем запросе, а не через TTL', async () => {
    const { owner, document } = await setupOrganizationDocument();
    const viewer = await register();

    await shares.grant({
      documentId: document.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    // Первое чтение прогревает кэш права.
    await expect(
      documents.get({ documentId: document.id, actorId: viewer.id }),
    ).resolves.toMatchObject({ id: document.id });

    await shares.revoke({
      documentId: document.id,
      userId: viewer.id,
      actorId: owner.id,
    });

    await expect(
      documents.get({ documentId: document.id, actorId: viewer.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('выдавать share может только владелец', async () => {
    const { owner, organization, document } = await setupOrganizationDocument();
    const member = await addOrganizationMember(organization.id, owner.id);
    const victim = await register();

    await expect(
      shares.grant({
        documentId: document.id,
        userId: victim.id,
        role: 'editor',
        actorId: member.id,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('список доступных документов учитывает share', async () => {
    const owner = await register();
    const document = await documents.createPersonal({
      actorId: owner.id,
      title: 'Личное',
    });
    const viewer = await register();

    await shares.grant({
      documentId: document.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    const list = await documents.listAccessible({ actorId: viewer.id });

    expect(list.map((item) => item.id)).toContain(document.id);
  });

  it('после удаления документа доступ пропадает', async () => {
    const { owner, document } = await setupOrganizationDocument();

    await documents.remove({ documentId: document.id, actorId: owner.id });

    await expect(
      documents.get({ documentId: document.id, actorId: owner.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('хранит share в схеме permission с уникальностью пары', async () => {
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count
from pg_indexes
where schemaname = 'permission' and tablename = 'document_shares'
  and indexdef ilike '%unique%' and indexdef ilike '%document_id%'
  and indexdef ilike '%user_id%'`,
    );

    expect(result.rows[0]?.count).not.toBe('0');
  });
});
