import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { DocumentService } from '../../src/document/document.service';
import { OrganizationService } from '../../src/organization/organization.service';
import { createTestApp } from '../utils';

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
    const moduleRef = await createTestApp();

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

    const document = await documentService.create({
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

    const document = await documentService.create({
      organizationId: first.id,
      actorId: owner.id,
      title: 'Первая',
    });

    const firstList = await documentService.list({
      organizationId: first.id,
      actorId: owner.id,
    });
    const secondList = await documentService.list({
      organizationId: second.id,
      actorId: owner.id,
    });

    expect(firstList.map((item) => item.id)).toContain(document.id);
    expect(secondList.map((item) => item.id)).not.toContain(document.id);
  });

  it('не отдаёт документ, если он в другой организации', async () => {
    const owner = await register();
    const first = await createOrganization(owner.id);
    const second = await createOrganization(owner.id);

    const document = await documentService.create({
      organizationId: first.id,
      actorId: owner.id,
      title: 'Первая',
    });

    await expect(
      documentService.get({
        organizationId: second.id,
        actorId: owner.id,
        documentId: document.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('обновляет документ и обновляет updated_at', async () => {
    const owner = await register();
    const organization = await createOrganization(owner.id);

    const document = await documentService.create({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Старое',
    });

    const updated = await documentService.update({
      organizationId: organization.id,
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

    const document = await documentService.create({
      organizationId: organization.id,
      actorId: owner.id,
      title: 'Временный',
    });

    await documentService.remove({
      organizationId: organization.id,
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
