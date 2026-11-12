import { randomUUID } from 'node:crypto';
import { MAX_UPLOAD_BYTES } from '@docs-app/contracts/file';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import * as schema from '../../src/database/schema';
import { StorageService } from '../../src/storage/storage.service';
import { createTestApp, readAccessToken } from '../utils';

const PASSWORD = 'correct horse battery staple';
const BUCKET = process.env.S3_BUCKET ?? 'documents';
const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('files (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let storage: StorageService;
  let close: () => Promise<void>;

  const registerAndLogin = async () => {
    const email = nextEmail();

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    expect(registered.status).toBe(201);

    await app.get(UserRepository).markEmailVerified(registered.body.id);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    return {
      email,
      id: registered.body.id as string,
      accessToken: readAccessToken(res),
    };
  };

  const createDocument = async (accessToken: string) => {
    const res = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Документ с вложениями' });

    expect(res.status).toBe(201);

    return res.body.id as string;
  };

  const requestUpload = (
    accessToken: string,
    payload: {
      filename: string;
      mime: string;
      size: number;
      documentId?: string;
    },
  ) =>
    request(app.getHttpServer())
      .post('/files/upload-url')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload);

  const putObject = async (
    upload: { url: string; headers: Record<string, string> },
    body: Buffer,
  ) => {
    const response = await fetch(upload.url, {
      method: 'PUT',
      body,
      headers: upload.headers,
    });

    expect(response.ok).toBe(true);
  };

  const complete = (accessToken: string, fileId: string) =>
    request(app.getHttpServer())
      .post(`/files/${fileId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`);

  const uploadReadyFile = async (
    accessToken: string,
    documentId: string,
    body = Buffer.from('fake image bytes'),
    mime = 'image/png',
    filename = 'pixel.png',
  ) => {
    const upload = await requestUpload(accessToken, {
      filename,
      mime,
      size: body.byteLength,
      documentId,
    });

    expect(upload.status).toBe(201);
    await putObject(upload.body, body);

    const completed = await complete(accessToken, upload.body.fileId);
    expect(completed.status).toBe(200);

    return {
      fileId: upload.body.fileId as string,
      body,
      completed: completed.body,
    };
  };

  const grantShare = (
    accessToken: string,
    documentId: string,
    email: string,
    role = 'viewer',
  ) =>
    request(app.getHttpServer())
      .post(`/documents/${documentId}/shares`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email, role });

  beforeAll(async () => {
    app = await createTestApp();
    await app.init();

    db = app.get(DATABASE);
    storage = app.get(StorageService);
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('проводит файл через presign → PUT → complete → download', async () => {
    const owner = await registerAndLogin();
    const documentId = await createDocument(owner.accessToken);
    const body = Buffer.from('настоящий png на самом деле нет');

    const upload = await requestUpload(owner.accessToken, {
      filename: 'pixel.png',
      mime: 'image/png',
      size: body.byteLength,
      documentId,
    });

    expect(upload.status).toBe(201);
    expect(upload.body).toMatchObject({
      fileId: expect.any(String),
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
    });

    await putObject(upload.body, body);

    const completed = await complete(owner.accessToken, upload.body.fileId);

    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({
      id: upload.body.fileId,
      documentId,
      ownerId: owner.id,
      status: 'ready',
      mime: 'image/png',
      size: body.byteLength,
    });

    // Бакет приватный: прямой GET без подписи не проходит.
    const [stored] = await db
      .select({ key: schema.files.key })
      .from(schema.files)
      .where(eq(schema.files.id, upload.body.fileId));

    const direct = await fetch(`${S3_ENDPOINT}/${BUCKET}/${stored.key}`);

    expect(direct.status).toBe(403);

    const listed = await request(app.getHttpServer())
      .get('/files')
      .query({ documentId })
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ id: upload.body.fileId });

    const download = await request(app.getHttpServer())
      .get(`/files/${upload.body.fileId}/download-url`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(download.status).toBe(200);
    expect(download.body).toMatchObject({
      url: expect.stringContaining('http'),
    });
    expect(Date.parse(download.body.expiresAt)).toBeGreaterThan(Date.now());

    const downloaded = await fetch(download.body.url);

    expect(downloaded.ok).toBe(true);
    await expect(downloaded.arrayBuffer()).resolves.toEqual(
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    );

    const content = await request(app.getHttpServer())
      .get(`/files/${upload.body.fileId}/content`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .redirects(0);

    expect(content.status).toBe(302);
    expect(content.headers.location).toContain('http');
  });

  it('удаляет файл, строку и объект в хранилище', async () => {
    const owner = await registerAndLogin();
    const documentId = await createDocument(owner.accessToken);
    const { fileId } = await uploadReadyFile(owner.accessToken, documentId);

    const [row] = await db
      .select({ key: schema.files.key })
      .from(schema.files)
      .where(eq(schema.files.id, fileId));

    expect(row).toBeDefined();

    const removed = await request(app.getHttpServer())
      .delete(`/files/${fileId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(removed.status).toBe(204);
    await expect(storage.exists(BUCKET, row.key)).resolves.toBe(false);

    const listed = await request(app.getHttpServer())
      .get('/files')
      .query({ documentId })
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(listed.body).toEqual([]);

    const download = await request(app.getHttpServer())
      .get(`/files/${fileId}/download-url`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(download.status).toBe(404);

    const audit = await db
      .select({ action: schema.auditEvents.action })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.targetId, fileId));

    expect(audit.map((event) => event.action)).toContain('file.removed');
  });

  it('не даёт загрузить файл в недоступный документ', async () => {
    const owner = await registerAndLogin();
    const outsider = await registerAndLogin();
    const documentId = await createDocument(owner.accessToken);

    const upload = await requestUpload(outsider.accessToken, {
      filename: 'pixel.png',
      mime: 'image/png',
      size: 16,
      documentId,
    });

    expect(upload.status).toBe(404);
  });

  it('viewer видит и скачивает файл, но не загружает и не удаляет', async () => {
    const owner = await registerAndLogin();
    const viewer = await registerAndLogin();
    const documentId = await createDocument(owner.accessToken);
    const { fileId } = await uploadReadyFile(owner.accessToken, documentId);

    await grantShare(owner.accessToken, documentId, viewer.email, 'viewer');

    const listed = await request(app.getHttpServer())
      .get('/files')
      .query({ documentId })
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(listed.status).toBe(200);
    expect(listed.body.map((file: { id: string }) => file.id)).toContain(
      fileId,
    );

    const download = await request(app.getHttpServer())
      .get(`/files/${fileId}/download-url`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(download.status).toBe(200);

    const upload = await requestUpload(viewer.accessToken, {
      filename: 'pixel.png',
      mime: 'image/png',
      size: 16,
      documentId,
    });

    expect(upload.status).toBe(403);

    const removed = await request(app.getHttpServer())
      .delete(`/files/${fileId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(removed.status).toBe(404);
  });

  it('отвечает 404 на чужой fileId', async () => {
    const owner = await registerAndLogin();
    const outsider = await registerAndLogin();
    const documentId = await createDocument(owner.accessToken);
    const { fileId } = await uploadReadyFile(owner.accessToken, documentId);

    // Последовательно: четыре параллельных supertest-запроса на один
    // неслушающий сервер поднимают его наперегонки и роняют парсер HTTP.
    const responses = [
      await request(app.getHttpServer())
        .get(`/files/${fileId}/download-url`)
        .set('Authorization', `Bearer ${outsider.accessToken}`),
      await request(app.getHttpServer())
        .get(`/files/${fileId}/content`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .redirects(0),
      await request(app.getHttpServer())
        .post(`/files/${fileId}/complete`)
        .set('Authorization', `Bearer ${outsider.accessToken}`),
      await request(app.getHttpServer())
        .delete(`/files/${fileId}`)
        .set('Authorization', `Bearer ${outsider.accessToken}`),
    ];

    for (const response of responses) {
      expect(response.status).toBe(404);
    }
  });

  it('отклоняет MIME вне allowlist до подписи', async () => {
    const owner = await registerAndLogin();
    const documentId = await createDocument(owner.accessToken);

    const upload = await requestUpload(owner.accessToken, {
      filename: 'icon.svg',
      mime: 'image/svg+xml',
      size: 128,
      documentId,
    });

    expect(upload.status).toBe(400);
  });

  it('отклоняет файл больше лимита до подписи', async () => {
    const owner = await registerAndLogin();
    const documentId = await createDocument(owner.accessToken);

    const upload = await requestUpload(owner.accessToken, {
      filename: 'huge.png',
      mime: 'image/png',
      size: MAX_UPLOAD_BYTES + 1,
      documentId,
    });

    expect(upload.status).toBe(400);
  });

  it('отклоняет complete, если объект в хранилище не появился', async () => {
    const owner = await registerAndLogin();
    const documentId = await createDocument(owner.accessToken);

    const upload = await requestUpload(owner.accessToken, {
      filename: 'pixel.png',
      mime: 'image/png',
      size: 16,
      documentId,
    });

    expect(upload.status).toBe(201);

    const completed = await complete(owner.accessToken, upload.body.fileId);

    expect(completed.status).toBe(400);
  });
});
