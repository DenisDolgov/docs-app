import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UserRepository } from '../../src/auth/user.repository';
import { createTestApp, readAccessToken } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('folder tree (e2e)', () => {
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

  const createOrganization = async (accessToken: string) => {
    const res = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Acme' });

    expect(res.status).toBe(201);

    return res.body.id as string;
  };

  const createFolder = (
    accessToken: string,
    organizationId: string,
    body: { name: string; parentId?: string | null },
  ) =>
    request(app.getHttpServer())
      .post(`/organizations/${organizationId}/folders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
    await app.init();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт папки и отдаёт дерево', async () => {
    const { accessToken } = await registerAndLogin();
    const organizationId = await createOrganization(accessToken);

    const root = await createFolder(accessToken, organizationId, {
      name: 'Проекты',
    });
    expect(root.status).toBe(201);
    expect(root.body).toMatchObject({
      name: 'Проекты',
      organizationId,
      parentId: null,
    });

    const child = await createFolder(accessToken, organizationId, {
      name: 'Архив',
      parentId: root.body.id,
    });
    expect(child.status).toBe(201);

    const tree = await request(app.getHttpServer())
      .get(`/organizations/${organizationId}/folders`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(tree.status).toBe(200);
    expect(tree.body).toHaveLength(1);
    expect(tree.body[0]).toMatchObject({
      id: root.body.id,
      children: [{ id: child.body.id, children: [] }],
    });
  });

  it('переименовывает и перемещает папку', async () => {
    const { accessToken } = await registerAndLogin();
    const organizationId = await createOrganization(accessToken);
    const target = await createFolder(accessToken, organizationId, {
      name: 'Цель',
    });
    const moving = await createFolder(accessToken, organizationId, {
      name: 'Старое',
    });

    const updated = await request(app.getHttpServer())
      .patch(`/folders/${moving.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Новое', parentId: target.body.id });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: moving.body.id,
      name: 'Новое',
      parentId: target.body.id,
    });
  });

  it('отвергает перемещение в собственного потомка', async () => {
    const { accessToken } = await registerAndLogin();
    const organizationId = await createOrganization(accessToken);
    const root = await createFolder(accessToken, organizationId, {
      name: 'Корень',
    });
    const child = await createFolder(accessToken, organizationId, {
      name: 'Ребёнок',
      parentId: root.body.id,
    });

    const res = await request(app.getHttpServer())
      .patch(`/folders/${root.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ parentId: child.body.id });

    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('удаляет только пустую папку', async () => {
    const { accessToken } = await registerAndLogin();
    const organizationId = await createOrganization(accessToken);
    const root = await createFolder(accessToken, organizationId, {
      name: 'Корень',
    });
    const child = await createFolder(accessToken, organizationId, {
      name: 'Ребёнок',
      parentId: root.body.id,
    });

    const blocked = await request(app.getHttpServer())
      .delete(`/folders/${root.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(blocked.status).toBe(409);

    const childRemoved = await request(app.getHttpServer())
      .delete(`/folders/${child.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(childRemoved.status).toBe(204);

    const rootRemoved = await request(app.getHttpServer())
      .delete(`/folders/${root.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(rootRemoved.status).toBe(204);
  });

  it('переносит документ в папку через PATCH документа', async () => {
    const { accessToken } = await registerAndLogin();
    const organizationId = await createOrganization(accessToken);
    const folder = await createFolder(accessToken, organizationId, {
      name: 'Проекты',
    });

    const document = await request(app.getHttpServer())
      .post(`/organizations/${organizationId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Заметки' });

    expect(document.status).toBe(201);
    expect(document.body.folderId).toBeNull();

    const moved = await request(app.getHttpServer())
      .patch(`/documents/${document.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ folderId: folder.body.id });

    expect(moved.status).toBe(200);
    expect(moved.body.folderId).toBe(folder.body.id);
  });
});
