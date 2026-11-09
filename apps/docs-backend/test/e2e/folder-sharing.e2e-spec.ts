import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UserRepository } from '../../src/auth/user.repository';
import { createTestApp, readAccessToken } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('folder sharing (e2e)', () => {
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

    return { email, accessToken: readAccessToken(res) };
  };

  const setup = async () => {
    const owner = await registerAndLogin();

    const organization = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Acme' });

    const folder = await request(app.getHttpServer())
      .post(`/organizations/${organization.body.id}/folders`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Проекты' });

    const document = await request(app.getHttpServer())
      .post(`/organizations/${organization.body.id}/documents`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Заметки' });

    await request(app.getHttpServer())
      .patch(`/documents/${document.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ folderId: folder.body.id });

    return {
      owner,
      organizationId: organization.body.id as string,
      folderId: folder.body.id as string,
      documentId: document.body.id as string,
    };
  };

  const grant = (
    accessToken: string,
    folderId: string,
    email: string,
    role: string,
  ) =>
    request(app.getHttpServer())
      .post(`/folders/${folderId}/shares`)
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

  it('share на папке открывает документ из неё', async () => {
    const { owner, folderId, documentId } = await setup();
    const viewer = await registerAndLogin();

    const granted = await grant(
      owner.accessToken,
      folderId,
      viewer.email,
      'viewer',
    );

    expect(granted.status).toBe(201);
    expect(granted.body).toMatchObject({
      folderId,
      email: viewer.email,
      role: 'viewer',
    });

    const read = await request(app.getHttpServer())
      .get(`/documents/${documentId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(read.status).toBe(200);

    const patch = await request(app.getHttpServer())
      .patch(`/documents/${documentId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ title: 'Правка' });

    expect(patch.status).toBe(403);
  });

  it('список share видит только владелец папки', async () => {
    const { owner, folderId } = await setup();
    const viewer = await registerAndLogin();

    await grant(owner.accessToken, folderId, viewer.email, 'viewer');

    const byOwner = await request(app.getHttpServer())
      .get(`/folders/${folderId}/shares`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(byOwner.status).toBe(200);
    expect(byOwner.body).toHaveLength(1);
    expect(byOwner.body[0].email).toBe(viewer.email);

    const byViewer = await request(app.getHttpServer())
      .get(`/folders/${folderId}/shares`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(byViewer.status).toBe(403);
  });

  it('отзыв share закрывает документ сразу', async () => {
    const { owner, folderId, documentId } = await setup();
    const viewer = await registerAndLogin();

    await grant(owner.accessToken, folderId, viewer.email, 'viewer');

    const granted = await request(app.getHttpServer())
      .get(`/folders/${folderId}/shares`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const userId = granted.body[0].userId as string;

    const revoked = await request(app.getHttpServer())
      .delete(`/folders/${folderId}/shares/${userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(revoked.status).toBe(204);

    const read = await request(app.getHttpServer())
      .get(`/documents/${documentId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(read.status).toBe(404);
  });

  it('не выдаёт share на папку чужой организации', async () => {
    const { folderId } = await setup();
    const stranger = await registerAndLogin();

    const res = await grant(
      stranger.accessToken,
      folderId,
      stranger.email,
      'viewer',
    );

    expect(res.status).toBe(404);
  });
});
