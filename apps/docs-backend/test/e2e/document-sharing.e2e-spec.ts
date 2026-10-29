import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestApp, readAccessToken } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

// HTTP-контур шаринга: управление доступом закрыто для всех, кроме владельца,
// а публичная ссылка живёт только как management-API (чтение по ней — S14).
describe('document sharing (e2e)', () => {
  let app: INestApplication;
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

  const setupDocument = async () => {
    const owner = await registerAndLogin();

    const created = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Общий документ' });

    expect(created.status).toBe(201);

    return { owner, documentId: created.body.id as string };
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
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('владелец выдаёт share по email и видит его в списке', async () => {
    const { owner, documentId } = await setupDocument();
    const target = await registerAndLogin();

    const granted = await grantShare(
      owner.accessToken,
      documentId,
      target.email,
      'commenter',
    );

    expect(granted.status).toBe(201);
    expect(granted.body).toMatchObject({
      documentId,
      userId: target.id,
      email: target.email,
      role: 'commenter',
    });

    const listed = await request(app.getHttpServer())
      .get(`/documents/${documentId}/shares`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ email: target.email });
  });

  it('share открывает документ получателю', async () => {
    const { owner, documentId } = await setupDocument();
    const target = await registerAndLogin();

    await grantShare(owner.accessToken, documentId, target.email, 'viewer');

    const read = await request(app.getHttpServer())
      .get(`/documents/${documentId}`)
      .set('Authorization', `Bearer ${target.accessToken}`);

    expect(read.status).toBe(200);
  });

  it('получатель share не может раздавать доступ', async () => {
    const { owner, documentId } = await setupDocument();
    const target = await registerAndLogin();
    const third = await registerAndLogin();

    await grantShare(owner.accessToken, documentId, target.email, 'editor');

    const attempt = await grantShare(
      target.accessToken,
      documentId,
      third.email,
    );

    expect(attempt.status).toBe(403);
  });

  it('чужой получает 404 на управление доступом', async () => {
    const { documentId } = await setupDocument();
    const outsider = await registerAndLogin();
    const third = await registerAndLogin();

    const attempt = await grantShare(
      outsider.accessToken,
      documentId,
      third.email,
    );

    expect(attempt.status).toBe(404);
  });

  it('share неизвестному адресу — 404', async () => {
    const { owner, documentId } = await setupDocument();

    const attempt = await grantShare(
      owner.accessToken,
      documentId,
      nextEmail(),
    );

    expect(attempt.status).toBe(404);
  });

  it('отзыв share сразу закрывает доступ', async () => {
    const { owner, documentId } = await setupDocument();
    const target = await registerAndLogin();

    await grantShare(owner.accessToken, documentId, target.email, 'viewer');

    const revoked = await request(app.getHttpServer())
      .delete(`/documents/${documentId}/shares/${target.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(revoked.status).toBe(204);

    const read = await request(app.getHttpServer())
      .get(`/documents/${documentId}`)
      .set('Authorization', `Bearer ${target.accessToken}`);

    expect(read.status).toBe(404);
  });

  it('публичная ссылка: токен виден только при создании', async () => {
    const { owner, documentId } = await setupDocument();

    const created = await request(app.getHttpServer())
      .post(`/documents/${documentId}/public-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ expiresAt: null });

    expect(created.status).toBe(201);
    expect(created.body.token).toEqual(expect.any(String));
    expect(created.body.role).toBe('viewer');

    const listed = await request(app.getHttpServer())
      .get(`/documents/${documentId}/public-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).not.toHaveProperty('token');
  });

  it('публичная ссылка отзывается и остаётся в списке отозванной', async () => {
    const { owner, documentId } = await setupDocument();

    const created = await request(app.getHttpServer())
      .post(`/documents/${documentId}/public-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({});

    const revoked = await request(app.getHttpServer())
      .delete(`/documents/${documentId}/public-links/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(revoked.status).toBe(204);

    const listed = await request(app.getHttpServer())
      .get(`/documents/${documentId}/public-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(listed.body[0].revokedAt).toEqual(expect.any(String));
  });

  it('получатель share не может создать публичную ссылку', async () => {
    const { owner, documentId } = await setupDocument();
    const target = await registerAndLogin();

    await grantShare(owner.accessToken, documentId, target.email, 'editor');

    const attempt = await request(app.getHttpServer())
      .post(`/documents/${documentId}/public-links`)
      .set('Authorization', `Bearer ${target.accessToken}`)
      .send({});

    expect(attempt.status).toBe(403);
  });

  it('просроченная и отозванная ссылка отдают 404 без сессии', async () => {
    const { owner, documentId } = await setupDocument();

    const created = await request(app.getHttpServer())
      .post(`/documents/${documentId}/public-links`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({});

    const token = created.body.token as string;

    const fresh = await request(app.getHttpServer()).get(
      `/public/documents/${token}`,
    );

    expect(fresh.status).toBe(200);
    expect(fresh.body.title).toBe('Общий документ');

    const db = app.get<Database>(DATABASE);
    await db.execute(
      sql`update permission.public_links set expires_at = now() - interval '1 second' where id = ${created.body.id}`,
    );

    const expired = await request(app.getHttpServer()).get(
      `/public/documents/${token}`,
    );

    expect(expired.status).toBe(404);

    await request(app.getHttpServer())
      .delete(`/documents/${documentId}/public-links/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const revoked = await request(app.getHttpServer()).get(
      `/public/documents/${token}`,
    );

    expect(revoked.status).toBe(404);
  });
});
