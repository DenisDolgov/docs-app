import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE, type Database } from '../../src/database/database.constants';
import * as schema from '../../src/database/schema';
import { createTestingModule } from '../utils';

// Приёмка куска S1: схема `document.comments` должна выражать инварианты,
// которые приложение не должно держать в голове. Пока таблицы и ограничений
// нет, все тесты падают — это и есть контракт куска.
describe('схема комментариев (integration)', () => {
  let db: Database;
  let close: () => Promise<void>;

  const insertDocument = async () => {
    const [document] = await db
      .insert(schema.documents)
      .values({ title: 'Комментарии', createdBy: randomUUID() })
      .returning({ id: schema.documents.id });

    return document.id;
  };

  const insertComment = async (
    overrides: Partial<typeof schema.comments.$inferInsert> = {},
  ) => {
    const [comment] = await db
      .insert(schema.comments)
      .values({
        documentId: await insertDocument(),
        authorId: randomUUID(),
        body: 'Фраза под вопросом',
        ...overrides,
      })
      .returning();

    return comment;
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт таблицу document.comments с нужными колонками', async () => {
    const result = await db.execute<{ column_name: string }>(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'document' and table_name = 'comments'
      order by column_name
    `);

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'anchor',
      'author_id',
      'body',
      'created_at',
      'document_id',
      'id',
      'parent_id',
      'resolved_at',
      'updated_at',
    ]);
  });

  it('не принимает тело длиннее 5000 символов', async () => {
    const documentId = await insertDocument();

    await expect(
      db.insert(schema.comments).values({
        documentId,
        authorId: randomUUID(),
        body: 'a'.repeat(5001),
      }),
    ).rejects.toBeDefined();
  });

  it('не принимает родителя из другого документа', async () => {
    const root = await insertComment();
    const otherDocumentId = await insertDocument();

    await expect(
      db.insert(schema.comments).values({
        documentId: otherDocumentId,
        parentId: root.id,
        authorId: randomUUID(),
        body: 'Ответ не в тот документ',
      }),
    ).rejects.toBeDefined();
  });

  it('удаляет ответы вместе с корнем', async () => {
    const root = await insertComment();

    await db.insert(schema.comments).values({
      documentId: root.documentId,
      parentId: root.id,
      authorId: randomUUID(),
      body: 'Ответ',
    });

    await db.delete(schema.comments).where(eq(schema.comments.id, root.id));

    const left = await db
      .select({ id: schema.comments.id })
      .from(schema.comments)
      .where(eq(schema.comments.documentId, root.documentId));

    expect(left).toEqual([]);
  });

  it('удаляет комментарии вместе с документом', async () => {
    const comment = await insertComment();

    await db
      .delete(schema.documents)
      .where(eq(schema.documents.id, comment.documentId));

    const left = await db
      .select({ id: schema.comments.id })
      .from(schema.comments)
      .where(eq(schema.comments.documentId, comment.documentId));

    expect(left).toEqual([]);
  });
});
