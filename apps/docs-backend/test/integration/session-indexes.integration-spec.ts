import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestingModule } from '../utils';

// Приёмка куска S3: индексы нужны под два реальных запроса — список сессий
// (`where user_id = ?`) и уборку старых токенов (`expires_at < ?`). Имена
// индексов не фиксируем: важен первый столбец, а не название.
describe('индексы сессий (integration)', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('под список сессий и GC есть индексы по user_id и expires_at', async () => {
    const result = await db.execute<{ column: string }>(sql`
      select distinct a.attname as "column"
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a
        on a.attrelid = t.oid and a.attnum = i.indkey[0]
      where n.nspname = 'auth'
        and t.relname = 'refresh_tokens'
    `);

    const indexedColumns = result.rows.map((row) => row.column);

    expect(indexedColumns).toEqual(
      expect.arrayContaining(['user_id', 'expires_at']),
    );
  });
});
