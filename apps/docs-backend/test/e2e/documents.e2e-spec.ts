import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('documents (e2e)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  const registerAndLogin = async () => {
    const email = nextEmail();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    return { email, accessToken: res.body.accessToken as string };
  };

  const createOrganization = (accessToken: string, name = 'Acme') =>
    request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name });

  const createDocument = (
    accessToken: string,
    organizationId: string,
    title = 'Заметки',
  ) =>
    request(app.getHttpServer())
      .post(`/organizations/${organizationId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title });

  const addMember = (
    accessToken: string,
    organizationId: string,
    email: string,
    role = 'member',
  ) =>
    request(app.getHttpServer())
      .post(`/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email, role });

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт документ и возвращает его с 201', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);

    const res = await createDocument(
      owner.accessToken,
      organization.body.id,
      'Заметки',
    );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      organizationId: organization.body.id,
      title: 'Заметки',
      createdBy: expect.any(String),
    });
  });

  it('отвечает 401 без access-токена', async () => {
    const res = await request(app.getHttpServer()).get(
      `/organizations/${randomUUID()}/documents`,
    );

    expect(res.status).toBe(401);
  });

  it('отвечает 400 на пустой заголовок', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);

    const res = await createDocument(
      owner.accessToken,
      organization.body.id,
      '',
    );

    expect(res.status).toBe(400);
  });

  it('отвечает 404, когда документ создаёт чужой пользователь', async () => {
    const owner = await registerAndLogin();
    const outsider = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);

    const res = await createDocument(
      outsider.accessToken,
      organization.body.id,
    );

    expect(res.status).toBe(404);
  });

  it('участник читает документ организации', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const created = await createDocument(
      owner.accessToken,
      organization.body.id,
    );

    const res = await request(app.getHttpServer())
      .get(
        `/organizations/${organization.body.id}/documents/${created.body.id}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.body.id, title: 'Заметки' });
  });

  it('отвечает 404 на документ чужой организации', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const other = await createOrganization(owner.accessToken, 'Other');
    const created = await createDocument(
      owner.accessToken,
      organization.body.id,
    );

    const res = await request(app.getHttpServer())
      .get(`/organizations/${other.body.id}/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('создатель обновляет документ, участник получает 403 на чужой', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const member = await registerAndLogin();
    await addMember(owner.accessToken, organization.body.id, member.email);
    const created = await createDocument(
      owner.accessToken,
      organization.body.id,
    );

    const forbidden = await request(app.getHttpServer())
      .patch(
        `/organizations/${organization.body.id}/documents/${created.body.id}`,
      )
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ title: 'Взлом' });

    expect(forbidden.status).toBe(403);

    const updated = await request(app.getHttpServer())
      .patch(
        `/organizations/${organization.body.id}/documents/${created.body.id}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Новое' });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id: created.body.id, title: 'Новое' });
  });

  it('создатель удаляет документ и получает 204', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const created = await createDocument(
      owner.accessToken,
      organization.body.id,
    );

    const removed = await request(app.getHttpServer())
      .delete(
        `/organizations/${organization.body.id}/documents/${created.body.id}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(removed.status).toBe(204);

    const after = await request(app.getHttpServer())
      .get(
        `/organizations/${organization.body.id}/documents/${created.body.id}`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(after.status).toBe(404);
  });
});
