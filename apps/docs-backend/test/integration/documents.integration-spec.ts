import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { DocumentService } from '../../src/document/document.service';
import { OrganizationService } from '../../src/organization/organization.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('documents (integration)', () => {
  let auth: AuthService;
  let organizationService: OrganizationService;
  let documentService: DocumentService;
  let db: Database;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    return { email, id: user.id };
  };

  const createOrganization = async (userId: string) =>
    organizationService.create({ userId, name: 'Acme' });

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    organizationService = moduleRef.get(OrganizationService);
    documentService = moduleRef.get(DocumentService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт документ внутри организации', async () => {
    const owner = await register();
    const organization = await createOrganization(owner.id);

    const document = await documentService.createInOrganization({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Заметки',
    });

    expect(document).toMatchObject({
      organizationId: organization.id,
      title: 'Заметки',
      createdBy: owner.id,
    });
    expect(document.id).toEqual(expect.any(String));
  });

  it('создаёт личный документ без организации', async () => {
    const owner = await register();

    const document = await documentService.createPersonal({
      actorId: owner.id,
      title: 'Личное',
    });

    expect(document).toMatchObject({
      organizationId: null,
      title: 'Личное',
      createdBy: owner.id,
    });
  });

  it('создаёт таблицу documents.documents с нужными колонками', async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
where table_schema = 'documents' and table_name = 'documents'
order by column_name`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'created_by',
      'id',
      'organization_id',
      'title',
      'updated_at',
    ]);
  });

  it('делает organization_id необязательной колонкой', async () => {
    const result = await db.execute<{ is_nullable: string }>(
      sql`select is_nullable from information_schema.columns
where table_schema = 'documents' and table_name = 'documents'
  and column_name = 'organization_id'`,
    );

    expect(result.rows[0]?.is_nullable).toBe('YES');
  });

  it('индексирует documents по organization_id', async () => {
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from pg_indexes
where schemaname = 'documents' and tablename = 'documents'
  and indexdef ilike '%organization_id%'`,
    );

    expect(result.rows[0]?.count).not.toBe('0');
  });

  it('не заводит cross-schema ссылок на organization или auth', async () => {
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count
from information_schema.table_constraints tc
where tc.table_schema = 'documents' and tc.table_name = 'documents'
  and tc.constraint_type = 'FOREIGN KEY'`,
    );

    expect(result.rows[0]?.count).toBe('0');
  });

  it('возвращает документы только своей организации', async () => {
    const owner = await register();
    const first = await createOrganization(owner.id);
    const second = await createOrganization(owner.id);

    const document = await documentService.createInOrganization({
      organizationId: first.id,
      actorId: owner.id,
      title: 'Первая',
    });

    const firstList = await documentService.listInOrganization({
      organizationId: first.id,
      actorId: owner.id,
    });
    const secondList = await documentService.listInOrganization({
      organizationId: second.id,
      actorId: owner.id,
    });

    expect(firstList.map((item) => item.id)).toContain(document.id);
    expect(secondList.map((item) => item.id)).not.toContain(document.id);
  });

  it('возвращает личные и организационные документы в общем списке', async () => {
    const owner = await register();
    const organization = await createOrganization(owner.id);

    const personal = await documentService.createPersonal({
      actorId: owner.id,
      title: 'Личное',
    });
    const organizational = await documentService.createInOrganization({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Общее',
    });

    const list = await documentService.listAccessible({ actorId: owner.id });
    const ids = list.map((item) => item.id);

    expect(ids).toContain(personal.id);
    expect(ids).toContain(organizational.id);
  });

  it('не отдаёт чужой личный документ в списке', async () => {
    const owner = await register();
    const outsider = await register();

    const personal = await documentService.createPersonal({
      actorId: owner.id,
      title: 'Личное',
    });

    const list = await documentService.listAccessible({ actorId: outsider.id });

    expect(list.map((item) => item.id)).not.toContain(personal.id);
  });

  it('не отдаёт документ, если он в другой организации', async () => {
    const owner = await register();
    const first = await createOrganization(owner.id);
    const second = await createOrganization(owner.id);
    const document = await documentService.createInOrganization({
      organizationId: first.id,
      actorId: owner.id,
      title: 'Первая',
    });
    await expect(
      documentService.get({
        actorId: owner.id,
        documentId: document.id,
      }),
    ).resolves.toMatchObject({ id: document.id });

    // Владелец уже имеет доступ; проверяем чужака с членством в другой организации.
    const outsider = await register();
    await organizationService.addMember({
      organizationId: second.id,
      actorId: owner.id,
      email: outsider.email,
      role: 'member',
    });
    await expect(
      documentService.get({
        actorId: outsider.id,
        documentId: document.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('обновляет документ и обновляет updated_at', async () => {
    const owner = await register();
    const organization = await createOrganization(owner.id);
    const document = await documentService.createInOrganization({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Старое',
    });
    const updated = await documentService.update({
      actorId: owner.id,
      documentId: document.id,
      title: 'Новое',
    });
    expect(updated.title).toBe('Новое');
    expect(updated.updatedAt >= document.updatedAt).toBe(true);
  });

  it('удаляет документ', async () => {
    const owner = await register();
    const organization = await createOrganization(owner.id);
    const document = await documentService.createInOrganization({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Временный',
    });
    await documentService.remove({
      actorId: owner.id,
      documentId: document.id,
    });
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from documents.documents
where id = ${document.id}`,
    );
    expect(result.rows[0]?.count).toBe('0');
  });
});
