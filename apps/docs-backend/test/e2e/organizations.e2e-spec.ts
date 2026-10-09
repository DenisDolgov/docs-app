import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('organizations (e2e)', () => {
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

  const addMember = (
    accessToken: string,
    organizationId: string,
    body: Record<string, unknown>,
  ) =>
    request(app.getHttpServer())
      .post(`/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('создаёт организацию и возвращает её с 201', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await createOrganization(accessToken, 'Acme');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(String), name: 'Acme' });
  });

  it('отвечает 401 без access-токена', async () => {
    const res = await request(app.getHttpServer())
      .post('/organizations')
      .send({ name: 'Acme' });

    expect(res.status).toBe(401);
  });

  it('отвечает 400 на пустое имя организации', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await createOrganization(accessToken, '');

    expect(res.status).toBe(400);
  });

  it('владелец добавляет участника по email и видит его в списке', async () => {
    const owner = await registerAndLogin();
    const created = await createOrganization(owner.accessToken);

    const invitedEmail = nextEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: invitedEmail, password: PASSWORD });

    const added = await addMember(owner.accessToken, created.body.id, {
      email: invitedEmail,
      role: 'member',
    });

    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({
      userId: expect.any(String),
      email: invitedEmail,
      role: 'member',
    });

    const list = await request(app.getHttpServer())
      .get(`/organizations/${created.body.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(list.status).toBe(200);
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: invitedEmail, role: 'member' }),
        expect.objectContaining({ email: owner.email, role: 'owner' }),
      ]),
    );
    for (const member of list.body) {
      expect(member).not.toHaveProperty('passwordHash');
      expect(member).not.toHaveProperty('password_hash');
    }
  });

  it('отвечает 403, когда добавляет обычный участник', async () => {
    const owner = await registerAndLogin();
    const created = await createOrganization(owner.accessToken);

    const member = await registerAndLogin();
    await addMember(owner.accessToken, created.body.id, {
      email: member.email,
      role: 'member',
    });

    const res = await addMember(member.accessToken, created.body.id, {
      email: nextEmail(),
      role: 'member',
    });

    expect(res.status).toBe(403);
  });

  it('отвечает 404, если приглашаемого пользователя нет', async () => {
    const owner = await registerAndLogin();
    const created = await createOrganization(owner.accessToken);

    const res = await addMember(owner.accessToken, created.body.id, {
      email: nextEmail(),
      role: 'member',
    });

    expect(res.status).toBe(404);
  });

  it('отвечает 409 на повторное добавление того же пользователя', async () => {
    const owner = await registerAndLogin();
    const created = await createOrganization(owner.accessToken);

    const member = await registerAndLogin();
    await addMember(owner.accessToken, created.body.id, {
      email: member.email,
      role: 'member',
    });

    const res = await addMember(owner.accessToken, created.body.id, {
      email: member.email,
      role: 'admin',
    });

    expect(res.status).toBe(409);
  });

  it('отвечает 400 на невалидные email и роль', async () => {
    const owner = await registerAndLogin();
    const created = await createOrganization(owner.accessToken);

    const badEmail = await addMember(owner.accessToken, created.body.id, {
      email: 'not-an-email',
      role: 'member',
    });
    expect(badEmail.status).toBe(400);

    const badRole = await addMember(owner.accessToken, created.body.id, {
      email: nextEmail(),
      role: 'superuser',
    });
    expect(badRole.status).toBe(400);
  });

  it('отвечает 404, когда чужой пользователь читает участников', async () => {
    const owner = await registerAndLogin();
    const outsider = await registerAndLogin();
    const created = await createOrganization(owner.accessToken);

    const res = await request(app.getHttpServer())
      .get(`/organizations/${created.body.id}/members`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.status).toBe(404);
  });
});
