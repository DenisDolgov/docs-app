import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { AuditService } from '../../src/audit/audit.service';
import { CollabService } from '../../src/collab/collab.service';
import { DocumentVersionRepository } from '../../src/collab/document-version.repository';
import { DocumentVersionService } from '../../src/collab/document-version.service';
import { VersionCheckpointService } from '../../src/collab/version-checkpoint.service';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { UnitOfWork } from '../../src/database/unit-of-work';
import type { AccessPolicyService } from '../../src/permission/access-policy.service';
import { createTestingModule } from '../utils';

const nextDocumentId = () => randomUUID();

// Право проверяется в e2e через HTTP; здесь важна механика версий, поэтому
// политика подменяется разрешающим шпионом.
const allowAccess = {
  assertDocumentAccess: async () => 'editor',
} as unknown as AccessPolicyService;

const textOf = (doc: Y.Doc) => doc.getText('content').toString();

describe('document versions (integration)', () => {
  let repository: DocumentVersionRepository;
  let collabService: CollabService;
  let versionService: DocumentVersionService;
  let checkpointService: VersionCheckpointService;
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    repository = moduleRef.get(DocumentVersionRepository);
    collabService = moduleRef.get(CollabService);
    checkpointService = moduleRef.get(VersionCheckpointService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();

    versionService = new DocumentVersionService(
      repository,
      collabService,
      allowAccess,
      moduleRef.get(AuditService),
      moduleRef.get(UnitOfWork),
    );
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт таблицу версий с колонками из брифа', async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
       where table_schema = 'collab' and table_name = 'document_versions'
       order by column_name`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'created_by',
      'document_id',
      'id',
      'kind',
      'name',
      'snapshot',
      'update_id',
    ]);
  });

  it('список отдаёт метаданные без снапшота, чтение по id — со снапшотом', async () => {
    const documentId = nextDocumentId();
    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'Version');
    const snapshot = Y.encodeStateAsUpdate(doc);

    const created = await repository.insert({
      documentId,
      kind: 'named',
      name: 'v1',
      snapshot,
      createdBy: nextDocumentId(),
      updateId: 5,
    });

    const listed = await repository.listByDocument(documentId);
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('v1');
    expect(Object.keys(listed[0])).not.toContain('snapshot');

    const found = await repository.findById(created.id);
    expect(found?.snapshot).toBeInstanceOf(Uint8Array);

    const restored = new Y.Doc();
    Y.applyUpdate(restored, found?.snapshot as Uint8Array);
    expect(textOf(restored)).toBe('Version');
  });

  it('авто-чекпоинт появляется по порогу и не дублируется каждый save', async () => {
    const documentId = nextDocumentId();
    const doc = new Y.Doc();
    doc.getText('content').insert(0, 'Checkpoint');
    const snapshot = Y.encodeStateAsUpdate(doc);

    const written = await checkpointService.maybeRecord({
      documentId,
      snapshot,
      updateId: 10,
      updatesSinceCheckpoint: 50,
    });
    expect(written).toBe(true);

    const duplicated = await checkpointService.maybeRecord({
      documentId,
      snapshot,
      updateId: 11,
      updatesSinceCheckpoint: 1,
    });
    expect(duplicated).toBe(false);

    const versions = await repository.listByDocument(documentId);
    expect(versions).toHaveLength(1);
    expect(versions[0].kind).toBe('checkpoint');
    expect(versions[0].name).toBeNull();
    expect(versions[0].updateId).toBe(10);
  });

  it('откат создаёт новую версию и не теряет старую', async () => {
    const documentId = nextDocumentId();
    const actorId = nextDocumentId();
    const room = await collabService.getRoom(documentId);

    room.doc.getText('content').insert(0, 'first');
    const version = await versionService.createNamed({
      documentId,
      actorId,
      name: 'before edit',
    });

    room.doc.getText('content').insert(5, ' second');
    await collabService.compact(documentId);

    const restored = await versionService.restore({
      documentId,
      versionId: version.id,
      actorId,
    });

    expect(restored.name).toBe('restored from before edit');
    expect(textOf(room.doc)).toBe('first');

    const versions = await repository.listByDocument(documentId);
    expect(versions.map((row) => row.name)).toEqual([
      'restored from before edit',
      'before edit',
    ]);

    // Перезапуск сервера: журнал плюс снапшот должны дать восстановленный текст.
    const journal = await db.execute<{ update: Buffer }>(
      sql`select update from collab.document_updates where document_id = ${documentId} order by id`,
    );
    const snapshotRow = await db.execute<{ snapshot: Buffer }>(
      sql`select snapshot from collab.document_snapshots where document_id = ${documentId}`,
    );

    const reopened = new Y.Doc();
    if (snapshotRow.rows[0]) {
      Y.applyUpdate(reopened, new Uint8Array(snapshotRow.rows[0].snapshot));
    }
    for (const row of journal.rows) {
      Y.applyUpdate(reopened, new Uint8Array(row.update));
    }
    expect(textOf(reopened)).toBe('first');
  });
});
