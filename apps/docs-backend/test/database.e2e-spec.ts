import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { DATABASE, type Database } from '../src/database/database.constants';

describe('database', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('выполняет запрос к Postgres', async () => {
    const result = await db.execute(sql`select 1 as ok`);

    expect(result.rows[0]).toEqual({ ok: 1 });
  });

  it('создает таблицу documents с нужными колонками', async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
where table_schema = 'documents' and table_name = 'documents' order by column_name`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'id',
      'title',
    ]);
  });
});
