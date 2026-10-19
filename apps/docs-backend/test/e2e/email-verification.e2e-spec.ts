import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestApp, readAccessToken } from '../utils';

// HTTP-обвязка двух маршрутов: коды ответов, валидация входа и гуард. Сам
// жизненный цикл токена проверен integration-спекой, поэтому здесь токен
// готовит тест — вставкой строки с известным хешем, без разбора MIME.
const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('email verification (e2e)', () => {
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

  // Свой токен, а не прочитанный из письма: e2e проверяет маршрут, а не MIME.
  const issueToken = async (userId: string) => {
    const token = randomBytes(32).toString('base64url');

    await db.execute(
      sql`insert into auth.email_verification_tokens (user_id, token_hash, expires_at)
          values (${userId}, ${sha256(token)}, now() + interval '1 hour')`,
    );

    return token;
  };

  const activeTokenHashes = async (userId: string) => {
    const result = await db.execute<{ token_hash: string }>(
      sql`select token_hash from auth.email_verification_tokens
          where user_id = ${userId} and used_at is null and expires_at > now()`,
    );

    return result.rows.map((row) => row.token_hash);
  };

  const verify = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/auth/email/verify').send(body);

  const resend = (accessToken?: string) => {
    const req = request(app.getHttpServer()).post('/auth/email/resend');

    return accessToken
      ? req.set('Authorization', `Bearer ${accessToken}`)
      : req;
  };

  it('подтверждает адрес по токену и отвечает 204', async () => {
    const { id } = await registerAndLogin();
    const token = await issueToken(id);

    const res = await verify({ token });

    expect(res.status).toBe(204);

    const result = await db.execute<{ email_verified_at: string | null }>(
      sql`select email_verified_at from auth.users where id = ${id}`,
    );
    expect(result.rows[0]?.email_verified_at).not.toBeNull();
  });

  it('отклоняет неизвестный токен', async () => {
    const res = await verify({ token: 'not-a-real-token' });

    expect(res.status).toBe(400);
  });

  it('отклоняет запрос без токена', async () => {
    const res = await verify({});

    expect(res.status).toBe(400);
  });

  it('не принимает один и тот же токен дважды', async () => {
    const { id } = await registerAndLogin();
    const token = await issueToken(id);

    expect((await verify({ token })).status).toBe(204);
    expect((await verify({ token })).status).toBe(400);
  });

  it('не переотправляет письмо без аутентификации', async () => {
    const res = await resend();

    expect(res.status).toBe(401);
  });

  it('по запросу выдаёт новый токен вместо прежнего', async () => {
    const { id, accessToken } = await registerAndLogin();

    const before = await activeTokenHashes(id);
    expect(before).toHaveLength(1);

    const res = await resend(accessToken);
    expect(res.status).toBe(204);

    const after = await activeTokenHashes(id);
    expect(after).toHaveLength(1);
    expect(after[0]).not.toBe(before[0]);
  });
});
