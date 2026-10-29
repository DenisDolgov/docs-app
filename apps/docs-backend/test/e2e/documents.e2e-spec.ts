import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UserRepository } from '../../src/auth/user.repository';
import { DocumentShareService } from '../../src/permission/document-share.service';
import { createTestApp, readAccessToken } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('documents (e2e)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  const registerAndLogin = async () => {
    const email = nextEmail();

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    expect(registered.status).toBe(201);

    // Организацию создаёт только подтверждённый пользователь.
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

  const createOrganization = (accessToken: string, name = 'Acme') =>
    request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name });

  const createOrganizationDocument = (
    accessToken: string,
    organizationId: string,
    title = 'Заметки',
  ) =>
    request(app.getHttpServer())
      .post(`/organizations/${organizationId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title });

  const createPersonalDocument = (accessToken: string, title = 'Личное') =>
    request(app.getHttpServer())
      .post('/documents')
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
    app = await createTestApp();
    await app.init();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт личный документ и возвращает его с 201', async () => {
    const owner = await registerAndLogin();

    const res = await createPersonalDocument(owner.accessToken, 'Личное');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      organizationId: null,
      title: 'Личное',
      createdBy: expect.any(String),
    });
  });

  it('создаёт документ организации и возвращает его с 201', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);

    const res = await createOrganizationDocument(
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
    const res = await request(app.getHttpServer()).get('/documents');

    expect(res.status).toBe(401);
  });

  it('отвечает 400 на пустой заголовок', async () => {
    const owner = await registerAndLogin();

    const res = await createPersonalDocument(owner.accessToken, '');

    expect(res.status).toBe(400);
  });

  it('отвечает 404, когда документ в организации создаёт чужой', async () => {
    const owner = await registerAndLogin();
    const outsider = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);

    const res = await createOrganizationDocument(
      outsider.accessToken,
      organization.body.id,
    );

    expect(res.status).toBe(404);
  });

  it('возвращает в списке личные и организационные документы', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const personal = await createPersonalDocument(owner.accessToken);
    const organizational = await createOrganizationDocument(
      owner.accessToken,
      organization.body.id,
    );

    const res = await request(app.getHttpServer())
      .get('/documents')
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.map((doc: { id: string }) => doc.id)).toEqual(
      expect.arrayContaining([personal.body.id, organizational.body.id]),
    );
  });

  it('не показывает чужой личный документ в списке', async () => {
    const owner = await registerAndLogin();
    const outsider = await registerAndLogin();
    const personal = await createPersonalDocument(owner.accessToken);

    const res = await request(app.getHttpServer())
      .get('/documents')
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.map((doc: { id: string }) => doc.id)).not.toContain(
      personal.body.id,
    );
  });

  it('владелец читает свой личный документ', async () => {
    const owner = await registerAndLogin();
    const created = await createPersonalDocument(owner.accessToken);

    const res = await request(app.getHttpServer())
      .get(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id,
      title: 'Личное',
    });
  });

  it('участник организации читает организационный документ', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const member = await registerAndLogin();
    await addMember(owner.accessToken, organization.body.id, member.email);
    const created = await createOrganizationDocument(
      owner.accessToken,
      organization.body.id,
    );

    const res = await request(app.getHttpServer())
      .get(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.body.id, title: 'Заметки' });
  });

  it('отвечает 404 на чужой личный документ', async () => {
    const owner = await registerAndLogin();
    const outsider = await registerAndLogin();
    const created = await createPersonalDocument(owner.accessToken);

    const res = await request(app.getHttpServer())
      .get(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('создатель обновляет документ, участник тоже может', async () => {
    const owner = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const member = await registerAndLogin();
    await addMember(owner.accessToken, organization.body.id, member.email);
    const created = await createOrganizationDocument(
      owner.accessToken,
      organization.body.id,
    );

    const updatedByOwner = await request(app.getHttpServer())
      .patch(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Новое' });
    expect(updatedByOwner.status).toBe(200);
    expect(updatedByOwner.body).toMatchObject({
      id: created.body.id,
      title: 'Новое',
    });

    const updatedByMember = await request(app.getHttpServer())
      .patch(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ title: 'Правка участника' });
    expect(updatedByMember.status).toBe(200);
  });

  it('отвечает 404, когда чужой пытается обновить документ', async () => {
    const owner = await registerAndLogin();
    const outsider = await registerAndLogin();
    const created = await createPersonalDocument(owner.accessToken);

    const res = await request(app.getHttpServer())
      .patch(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ title: 'Взлом' });

    expect(res.status).toBe(404);
  });

  it('создатель удаляет документ и получает 204', async () => {
    const owner = await registerAndLogin();
    const created = await createPersonalDocument(owner.accessToken);

    const removed = await request(app.getHttpServer())
      .delete(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(removed.status).toBe(204);

    const after = await request(app.getHttpServer())
      .get(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(after.status).toBe(404);
  });

  it('отвечает 404, когда чужой пытается удалить документ', async () => {
    const owner = await registerAndLogin();
    const outsider = await registerAndLogin();
    const created = await createPersonalDocument(owner.accessToken);

    const res = await request(app.getHttpServer())
      .delete(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('отдаёт shared-документ в списке доступных', async () => {
    const owner = await registerAndLogin();
    const viewer = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const created = await createOrganizationDocument(
      owner.accessToken,
      organization.body.id,
    );

    await app.get(DocumentShareService).grant({
      documentId: created.body.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    const res = await request(app.getHttpServer())
      .get('/documents')
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.map((item: { id: string }) => item.id)).toContain(
      created.body.id,
    );
  });

  it('viewer через share читает документ, но не пишет', async () => {
    const owner = await registerAndLogin();
    const viewer = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const created = await createOrganizationDocument(
      owner.accessToken,
      organization.body.id,
    );

    await app.get(DocumentShareService).grant({
      documentId: created.body.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    const read = await request(app.getHttpServer())
      .get(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(read.status).toBe(200);

    const write = await request(app.getHttpServer())
      .patch(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ title: 'Правка viewer-а' });
    expect(write.status).toBe(404);

    const remove = await request(app.getHttpServer())
      .delete(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(remove.status).toBe(404);
  });

  it('отзыв share закрывает доступ на следующем запросе', async () => {
    const owner = await registerAndLogin();
    const viewer = await registerAndLogin();
    const organization = await createOrganization(owner.accessToken);
    const created = await createOrganizationDocument(
      owner.accessToken,
      organization.body.id,
    );
    const shares = app.get(DocumentShareService);

    await shares.grant({
      documentId: created.body.id,
      userId: viewer.id,
      role: 'viewer',
      actorId: owner.id,
    });

    // Первый запрос прогревает кэш права — отзыв обязан его обойти.
    const whileGranted = await request(app.getHttpServer())
      .get(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(whileGranted.status).toBe(200);

    await shares.revoke({
      documentId: created.body.id,
      userId: viewer.id,
      actorId: owner.id,
    });

    const afterRevoke = await request(app.getHttpServer())
      .get(`/documents/${created.body.id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(afterRevoke.status).toBe(404);
  });

  it('отвечает 400 на documentId, который не UUID', async () => {
    const owner = await registerAndLogin();

    const read = await request(app.getHttpServer())
      .get('/documents/not-a-uuid')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(read.status).toBe(400);

    const write = await request(app.getHttpServer())
      .patch('/documents/not-a-uuid')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Новое' });
    expect(write.status).toBe(400);
  });

  it('отвечает 400 на organizationId, который не UUID', async () => {
    const owner = await registerAndLogin();

    const res = await request(app.getHttpServer())
      .get('/organizations/not-a-uuid/documents')
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(400);
  });
});
