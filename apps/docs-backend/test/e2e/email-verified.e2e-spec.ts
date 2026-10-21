import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestApp, readAccessToken } from '../utils';

// HTTP-обвязка флага и политики: форма ответа `/auth/me`, коды отказа и то, что
// решение принимается по базе, а не по данным внутри access-токена. Жизненный
// цикл подтверждения уже покрыт integration-спекой, поэтому токен здесь вставляет
// сам тест — без разбора MIME.
const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('email verified (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    app = await createTestApp();
    await app.init();
    db = app.get(DATABASE);
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  const registerAndLogin = async () => {
    const email = nextEmail();

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    const loggedIn = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    return {
      id: registered.body.id as string,
      email,
      accessToken: readAccessToken(loggedIn),
    };
  };

  const me = (accessToken?: string) => {
    const req = request(app.getHttpServer()).get('/auth/me');

    return accessToken
      ? req.set('Authorization', `Bearer ${accessToken}`)
      : req;
  };

  const createOrganization = (accessToken: string, name = 'Acme') =>
    request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name });

  const createPersonalDocument = (accessToken: string, title = 'Личное') =>
    request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title });

  // Свой токен, а не прочитанный из письма: e2e проверяет маршрут подтверждения,
  // а не разбор MIME.
  const issueToken = async (userId: string) => {
    const token = randomBytes(32).toString('base64url');

    await db.execute(
      sql`insert into auth.email_verification_tokens (user_id, token_hash, expires_at)
          values (${userId}, ${sha256(token)}, now() + interval '1 hour')`,
    );

    return token;
  };

  it('отдаёт emailVerified: false и только три поля', async () => {
    const { email, accessToken } = await registerAndLogin();

    const res = await me(accessToken);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      'email',
      'emailVerified',
      'id',
    ]);
    expect(res.body).toMatchObject({ email, emailVerified: false });
    expect(res.body).not.toHaveProperty('emailVerifiedAt');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('запрещает создавать организацию до подтверждения', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await createOrganization(accessToken);

    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      status: 403,
      detail: 'Email is not verified',
    });

    const list = await request(app.getHttpServer())
      .get('/organizations')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(list.body).toEqual([]);
  });

  it('разрешает личные документы до подтверждения', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await createPersonalDocument(accessToken);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Личное' });
  });

  it('после подтверждения тот же токен сразу видит true и создаёт организацию', async () => {
    const { id, accessToken } = await registerAndLogin();
    const token = await issueToken(id);

    expect((await me(accessToken)).body.emailVerified).toBe(false);

    const verified = await request(app.getHttpServer())
      .post('/auth/email/verify')
      .send({ token });

    expect(verified.status).toBe(204);

    // Access-токен остался прежним: если флаг брать из JWT, здесь будет false.
    expect((await me(accessToken)).body.emailVerified).toBe(true);
    expect((await createOrganization(accessToken)).status).toBe(201);
  });

  it('отвечает 401 на /auth/me без токена', async () => {
    const res = await me();

    expect(res.status).toBe(401);
  });
});
