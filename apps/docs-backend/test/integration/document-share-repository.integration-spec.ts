import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE, type Database } from '../../src/database/database.constants';
import { DocumentShareRepository } from '../../src/permission/document-share.repository';
import { createTestingModule } from '../utils';

// Репозиторий проверяется отдельно от политики: SQL-инварианты
// (`upsert` по уникальной паре, `DELETE ... RETURNING`) не должны зависеть от
// того, доработано ли вычисление права.
describe('DocumentShareRepository (integration)', () => {
  let db: Database;
  let repository: DocumentShareRepository;
  let close: () => Promise<void>;

  const documentId = () => randomUUID();
  const actorId = randomUUID();

  const countShares = async (id: string) => {
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from permission.document_shares
where document_id = ${id}`,
    );

    return result.rows[0]?.count;
  };

  // Список share отдаёт email, поэтому участник должен быть настоящим
  // пользователем: join с `auth.users` — часть контракта read-модели.
  const createUser = async () => {
    const email = `share-user-${randomUUID()}@example.com`;
    const result = await db.execute<{ id: string }>(
      sql`insert into auth.users (email, password_hash) values (${email}, 'x') returning id`,
    );

    return { id: result.rows[0]!.id, email };
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    db = moduleRef.get(DATABASE);
    repository = new DocumentShareRepository(db);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('вставляет share и возвращает его в форме view', async () => {
    const target = documentId();
    const userId = randomUUID();

    const share = await repository.upsert({
      documentId: target,
      userId,
      role: 'viewer',
      actorId,
    });

    expect(share).toMatchObject({
      id: expect.any(String),
      documentId: target,
      userId,
      role: 'viewer',
      createdBy: actorId,
    });
    expect(share.createdAt).toEqual(expect.any(String));
  });

  it('повторный upsert меняет роль, а не добавляет строку', async () => {
    const target = documentId();
    const userId = randomUUID();

    await repository.upsert({
      documentId: target,
      userId,
      role: 'viewer',
      actorId,
    });
    await repository.upsert({
      documentId: target,
      userId,
      role: 'editor',
      actorId,
    });

    expect(await countShares(target)).toBe('1');

    const found = await repository.findByDocumentAndUser(target, userId);
    expect(found?.role).toBe('editor');
  });

  it('находит share по документу и пользователю', async () => {
    const target = documentId();
    const userId = randomUUID();

    await repository.upsert({
      documentId: target,
      userId,
      role: 'commenter',
      actorId,
    });

    await expect(
      repository.findByDocumentAndUser(target, userId),
    ).resolves.toMatchObject({ documentId: target, userId, role: 'commenter' });
  });

  it('не находит share другого пользователя', async () => {
    const target = documentId();

    await repository.upsert({
      documentId: target,
      userId: randomUUID(),
      role: 'viewer',
      actorId,
    });

    await expect(
      repository.findByDocumentAndUser(target, randomUUID()),
    ).resolves.toBeNull();
  });

  it('удаляет share и сообщает, была ли строка', async () => {
    const target = documentId();
    const userId = randomUUID();

    await repository.upsert({
      documentId: target,
      userId,
      role: 'viewer',
      actorId,
    });

    await expect(
      repository.deleteByDocumentAndUser(target, userId),
    ).resolves.toBe(true);
    await expect(
      repository.deleteByDocumentAndUser(target, userId),
    ).resolves.toBe(false);
    expect(await countShares(target)).toBe('0');
  });

  it('перечисляет share документа в порядке выдачи', async () => {
    const target = documentId();
    const first = await createUser();
    const second = await createUser();

    await repository.upsert({
      documentId: target,
      userId: first.id,
      role: 'viewer',
      actorId,
    });
    await repository.upsert({
      documentId: target,
      userId: second.id,
      role: 'editor',
      actorId,
    });

    const shares = await repository.listByDocument(target);

    expect(shares).toHaveLength(2);
    expect(shares.map((share) => share.email)).toEqual(
      expect.arrayContaining([first.email, second.email]),
    );
  });
});
