import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { S3 } from '../../src/storage/storage.constants';
import { StorageService } from '../../src/storage/storage.service';
import { createTestApp, waitFor } from '../utils';

const BUCKET = 'documents';
const KEY = 'hello.txt';
const BODY = 'объектное хранилище';

describe('storage', () => {
  let client: S3Client;
  let storage: StorageService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    client = moduleRef.get(S3);
    storage = moduleRef.get(StorageService);
    close = () => moduleRef.close();

    await storage.ensureBucket(BUCKET);
    await storage.remove(BUCKET, KEY).catch(() => undefined);
  });

  afterAll(async () => {
    await storage.remove(BUCKET, KEY).catch(() => undefined);
    await storage.removeBucket(BUCKET).catch(() => undefined);
    await close();
  });

  it('загружает объект по presigned PUT ссылке', async () => {
    const url = await storage.presignUpload(BUCKET, KEY, 'text/plain');

    const response = await fetch(url, {
      method: 'PUT',
      body: BODY,
      headers: { 'content-type': 'text/plain' },
    });

    expect(response.ok).toBe(true);

    await waitFor(async () => storage.exists(BUCKET, KEY));

    const head = await storage.head(BUCKET, KEY);

    expect(head.ContentLength).toBe(Buffer.byteLength(BODY));
    expect(head.ContentType).toBe('text/plain');
  });

  it('отдаёт объект по presigned GET ссылке', async () => {
    const url = await storage.presignDownload(BUCKET, KEY);

    const response = await fetch(url);

    expect(response.ok).toBe(true);
    await expect(response.text()).resolves.toBe(BODY);
  });

  it('достаёт объект через клиент из DI', async () => {
    const output = await client.send(
      new HeadObjectCommand({
        Bucket: BUCKET,
        Key: KEY,
      }),
    );

    expect(output.ContentLength).toBe(Buffer.byteLength(BODY));
  });

  it('удаляет объект', async () => {
    await storage.remove(BUCKET, KEY);

    await expect(storage.exists(BUCKET, KEY)).resolves.toBe(false);
  });
});
