import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE, type Database } from '../../src/database/database.constants';
import * as schema from '../../src/database/schema';
import { FILE_BUCKET } from '../../src/file/file.constants';
import { FileRepository } from '../../src/file/file.repository';
import { FileGcService } from '../../src/file/file-gc.service';
import { StorageService } from '../../src/storage/storage.service';
import { createTestingModule } from '../utils';

const DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000010';
const OWNER_ID = '0192f5b0-1c00-7000-8000-000000000011';
const DAY = 24 * 60 * 60 * 1000;

describe('files (integration)', () => {
  let fileRepository: FileRepository;
  let fileGc: FileGcService;
  let storage: StorageService;
  let bucket: string;
  let db: Database;
  let close: () => Promise<void>;

  const pendingFile = (overrides: { documentId?: string | null } = {}) =>
    fileRepository.createPending({
      ownerId: OWNER_ID,
      organizationId: null,
      documentId:
        overrides.documentId === undefined ? DOCUMENT_ID : overrides.documentId,
      key: `files/${randomUUID()}`,
      name: 'скан.pdf',
      mime: 'application/pdf',
      size: 1024,
    });

  const putObject = async (key: string) => {
    const url = await storage.presignUpload(bucket, key, 'application/pdf');
    const response = await fetch(url, {
      method: 'PUT',
      body: Buffer.from('pdf'),
      headers: { 'content-type': 'application/pdf' },
    });

    expect(response.ok).toBe(true);
  };

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    fileRepository = moduleRef.get(FileRepository);
    fileGc = moduleRef.get(FileGcService);
    storage = moduleRef.get(StorageService);
    bucket = moduleRef.get(FILE_BUCKET);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();

    // `compile()` не вызывает `onModuleInit`, поэтому бакет готовим явно:
    // `storage.integration-spec` мог удалить его в своём `afterAll`.
    await storage.ensureBucket(bucket);
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт таблицу file.files с нужными колонками', async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
where table_schema = 'file' and table_name = 'files'
order by column_name`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'document_id',
      'id',
      'key',
      'mime',
      'name',
      'organization_id',
      'owner_id',
      'size',
      'status',
    ]);
  });

  it('создаёт строку в pending и переводит её в ready по фактам', async () => {
    const pending = await pendingFile();

    expect(pending).toMatchObject({
      ownerId: OWNER_ID,
      documentId: DOCUMENT_ID,
      name: 'скан.pdf',
      mime: 'application/pdf',
      size: 1024,
      status: 'pending',
    });

    const ready = await fileRepository.markReady(pending.id, {
      size: 2048,
      mime: 'application/pdf',
    });

    expect(ready).toMatchObject({
      id: pending.id,
      status: 'ready',
      size: 2048,
      mime: 'application/pdf',
    });
  });

  it('отдаёт списком по документу только готовые файлы', async () => {
    const documentId = randomUUID();
    const ready = await pendingFile({ documentId });

    await fileRepository.markReady(ready.id, {
      size: 1024,
      mime: 'application/pdf',
    });
    await pendingFile({ documentId });

    const listed = await fileRepository.listReadyByDocument(documentId);

    expect(listed.map((file) => file.id)).toEqual([ready.id]);
  });

  it('выбирает просроченные pending, не трогая свежие и готовые', async () => {
    const cutoff = new Date(Date.now() - DAY);
    const oldPending = await pendingFile();
    const freshPending = await pendingFile();
    const oldReady = await pendingFile();

    await fileRepository.markReady(oldReady.id, {
      size: 1024,
      mime: 'application/pdf',
    });

    const createdAt = new Date(Date.now() - 2 * DAY);

    for (const file of [oldPending, oldReady]) {
      await db
        .update(schema.files)
        .set({ createdAt })
        .where(eq(schema.files.id, file.id));
    }

    const expired = await fileRepository.findExpiredPending(cutoff);
    const ids = expired.map((file) => file.id);

    expect(ids).toContain(oldPending.id);
    expect(ids).not.toContain(freshPending.id);
    expect(ids).not.toContain(oldReady.id);
  });

  it('уборка удаляет объект и строку pending, не трогая ready', async () => {
    const oldPending = await pendingFile();
    const freshPending = await pendingFile();
    const oldReady = await pendingFile();

    await fileRepository.markReady(oldReady.id, {
      size: 1024,
      mime: 'application/pdf',
    });

    await putObject(oldPending.key);
    await putObject(freshPending.key);
    await putObject(oldReady.key);

    const old = new Date(Date.now() - 2 * DAY);

    for (const file of [oldPending, oldReady]) {
      await db
        .update(schema.files)
        .set({ createdAt: old })
        .where(eq(schema.files.id, file.id));
    }

    const removed = await fileGc.cleanup();

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await fileRepository.findById(oldPending.id)).toBeNull();
    await expect(storage.exists(bucket, oldPending.key)).resolves.toBe(false);

    expect(await fileRepository.findById(freshPending.id)).not.toBeNull();
    await expect(storage.exists(bucket, freshPending.key)).resolves.toBe(true);

    expect(await fileRepository.findById(oldReady.id)).not.toBeNull();
    await expect(storage.exists(bucket, oldReady.key)).resolves.toBe(true);

    await storage.remove(bucket, freshPending.key);
    await storage.remove(bucket, oldReady.key);
  });
});
