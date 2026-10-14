import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { CollabRepository } from '../../src/collab/collab.repository';
import { CollabService } from '../../src/collab/collab.service';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestApp, waitFor } from '../utils';

const nextDocumentId = () => randomUUID();

describe('collab persistence (integration)', () => {
  let repository: CollabRepository;
  let service: CollabService;
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    repository = moduleRef.get(CollabRepository);
    service = moduleRef.get(CollabService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт таблицы collab с нужными колонками', async () => {
    const updates = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
where table_schema = 'collab' and table_name = 'document_updates' order by column_name`,
    );
    const snapshots = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
where table_schema = 'collab' and table_name = 'document_snapshots' order by column_name`,
    );

    expect(updates.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'document_id',
      'id',
      'update',
    ]);
    expect(snapshots.rows.map((row) => row.column_name)).toEqual([
      'document_id',
      'snapshot',
      'updated_at',
    ]);
  });

  it('хранит апдейты append-only и изолирует по documentId', async () => {
    const first = nextDocumentId();
    const second = nextDocumentId();
    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'Hello');

    await repository.appendUpdate(
      first,
      Buffer.from(Y.encodeStateAsUpdate(doc)),
    );
    doc.getText('content').insert(5, ' World');
    await repository.appendUpdate(
      first,
      Buffer.from(Y.encodeStateAsUpdate(doc)),
    );

    const listed = await repository.listUpdates(first);
    expect(listed.length).toBe(2);

    const restored = new Y.Doc();
    for (const bytes of listed) Y.applyUpdate(restored, new Uint8Array(bytes));
    expect(restored.getText('content').toString()).toBe('Hello World');

    expect(await repository.listUpdates(second)).toEqual([]);
  });

  it('перезаписывает снапшот и отдаёт null на пустом документе', async () => {
    const documentId = nextDocumentId();
    expect(await repository.loadSnapshot(documentId)).toBeNull();

    const first = new Y.Doc();
    first.getText('content').insert(0, 'one');
    await repository.saveSnapshot(
      documentId,
      Buffer.from(Y.encodeStateAsUpdate(first)),
    );

    const second = new Y.Doc();
    second.getText('content').insert(0, 'two');
    await repository.saveSnapshot(
      documentId,
      Buffer.from(Y.encodeStateAsUpdate(second)),
    );

    const loaded = await repository.loadSnapshot(documentId);
    expect(loaded).not.toBeNull();
    const restored = new Y.Doc();
    Y.applyUpdate(restored, new Uint8Array(loaded as Buffer));
    expect(restored.getText('content').toString()).toBe('two');
  });

  it('комната переживает перезапуск: снапшот плюс апдейты после него', async () => {
    const documentId = nextDocumentId();
    const room = await service.getRoom(documentId);
    room.doc.getText('content').insert(0, 'Hello');

    await waitFor(
      async () => (await repository.listUpdates(documentId)).length > 0,
    );
    await service.compact(documentId);

    expect(await repository.listUpdates(documentId)).toEqual([]);
    expect(await repository.loadSnapshot(documentId)).not.toBeNull();

    room.doc.getText('content').insert(5, ' World');
    await waitFor(
      async () => (await repository.listUpdates(documentId)).length > 0,
    );

    const snapshot = await repository.loadSnapshot(documentId);
    const updates = await repository.listUpdates(documentId);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, new Uint8Array(snapshot as Buffer));
    for (const bytes of updates) Y.applyUpdate(restored, new Uint8Array(bytes));
    expect(restored.getText('content').toString()).toBe('Hello World');
  });
});
