import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditRepository } from '../../src/audit/audit.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestingModule } from '../utils';

// Append-only — свойство хранилища, а не договорённость в коде: даже прямой SQL
// не может переписать или удалить событие.
describe('audit append-only (integration)', () => {
  let repository: AuditRepository;
  let db: Database;
  let close: () => Promise<void>;

  const nextEvent = () => ({
    actorId: randomUUID(),
    action: 'auth.login' as const,
    targetType: 'user' as const,
    targetId: randomUUID(),
    metadata: {},
  });

  const countByActor = async (actorId: string) => {
    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from audit.events where actor_id = ${actorId}`,
    );

    return Number(result.rows[0]?.count ?? 0);
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    repository = moduleRef.get(AuditRepository);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('принимает событие без существующей цели: FK на цель нет', async () => {
    const event = nextEvent();

    await expect(repository.insert(event)).resolves.toBeUndefined();
    await expect(countByActor(event.actorId)).resolves.toBe(1);
  });

  it('отклоняет UPDATE события', async () => {
    const event = nextEvent();
    await repository.insert(event);

    await expect(
      db.execute(
        sql`update audit.events set action = 'tampered' where actor_id = ${event.actorId}`,
      ),
    ).rejects.toThrow();

    const result = await db.execute<{ action: string }>(
      sql`select action from audit.events where actor_id = ${event.actorId}`,
    );

    expect(result.rows[0]?.action).toBe('auth.login');
  });

  it('отклоняет DELETE события', async () => {
    const event = nextEvent();
    await repository.insert(event);

    await expect(
      db.execute(
        sql`delete from audit.events where actor_id = ${event.actorId}`,
      ),
    ).rejects.toThrow();

    await expect(countByActor(event.actorId)).resolves.toBe(1);
  });

  it('событие переживает удаление цели', async () => {
    const documentId = randomUUID();
    const actorId = randomUUID();

    await db.execute(
      sql`insert into document.documents (id, title, created_by) values (${documentId}, 'Временный', ${actorId})`,
    );

    await repository.insert({
      actorId,
      action: 'document.removed',
      targetType: 'document',
      targetId: documentId,
    });

    await db.execute(
      sql`delete from document.documents where id = ${documentId}`,
    );

    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from audit.events where target_type = 'document' and target_id = ${documentId}`,
    );

    expect(Number(result.rows[0]?.count ?? 0)).toBe(1);
  });
});
