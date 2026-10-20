import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestApp } from '../utils';

// HTTP-обвязка двух маршрутов: коды ответов, валидация входа и отсутствие
// гуарда. Жизненный цикл токена проверен integration-спекой, поэтому здесь
// токен готовит сам тест — вставкой строки с известным хешем, без разбора MIME.
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'new correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('password reset (e2e)', () => {
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

  const register = async () => {
    const email = nextEmail();

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    return { id: registered.body.id as string, email };
  };

  // Свой токен, а не прочитанный из письма: e2e проверяет маршрут, а не MIME.
  const issueToken = async (userId: string) => {
    const token = randomBytes(32).toString('base64url');

    await db.execute(
      sql`insert into auth.password_reset_tokens (user_id, token_hash, expires_at)
          values (${userId}, ${sha256(token)}, now() + interval '1 hour')`,
    );

    return token;
  };

  const forgot = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/auth/password/forgot').send(body);

  const reset = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/auth/password/reset').send(body);

  it('отвечает 204 и на существующий, и на несуществующий адрес', async () => {
    const { email } = await register();

    expect((await forgot({ email })).status).toBe(204);
    expect((await forgot({ email: nextEmail() })).status).toBe(204);
  });

  it('отклоняет запрос без email', async () => {
    const res = await forgot({});

    expect(res.status).toBe(400);
  });

  it('отклоняет невалидный email', async () => {
    const res = await forgot({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('сбрасывает пароль по токену и отвечает 204', async () => {
    const { id } = await register();
    const token = await issueToken(id);

    const res = await reset({ token, password: NEW_PASSWORD });

    expect(res.status).toBe(204);

    const result = await db.execute<{ used_at: string | null }>(
      sql`select used_at from auth.password_reset_tokens
          where user_id = ${id} and token_hash = ${sha256(token)}`,
    );
    expect(result.rows[0]?.used_at).not.toBeNull();
  });

  it('не принимает один и тот же токен дважды', async () => {
    const { id } = await register();
    const token = await issueToken(id);

    expect((await reset({ token, password: NEW_PASSWORD })).status).toBe(204);
    expect((await reset({ token, password: PASSWORD })).status).toBe(400);
  });

  it('отклоняет неизвестный токен', async () => {
    const token = randomBytes(32).toString('base64url');
    const res = await reset({ token, password: NEW_PASSWORD });

    expect(res.status).toBe(400);
  });

  it('отклоняет запрос без токена', async () => {
    const res = await reset({ password: NEW_PASSWORD });

    expect(res.status).toBe(400);
  });

  it('отклоняет токен неверного формата', async () => {
    const res = await reset({ token: 'short', password: NEW_PASSWORD });

    expect(res.status).toBe(400);
  });

  it('отклоняет слишком короткий пароль', async () => {
    const { id } = await register();
    const token = await issueToken(id);

    const res = await reset({ token, password: 'short' });

    expect(res.status).toBe(400);
  });
});
