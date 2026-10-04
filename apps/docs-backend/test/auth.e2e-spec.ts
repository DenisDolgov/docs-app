import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { DATABASE, type Database } from '../src/database/database.constants';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('POST /auth/register', () => {
  let app: INestApplication;
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    db = moduleRef.get(DATABASE);
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('регистрирует пользователя и возвращает его без хеша пароля', async () => {
    const email = nextEmail();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      email,
    });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('хранит argon2id-хеш, а не открытый пароль', async () => {
    const email = nextEmail();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    const result = await db.execute<{ password_hash: string }>(
      sql`select password_hash from auth.users where email = ${email}`,
    );

    const hash = result.rows[0]?.password_hash;

    if (hash === undefined) {
      throw new Error('password_hash не записан в auth.users');
    }
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(argon2.verify(hash, PASSWORD)).resolves.toBe(true);
  });

  it('отклоняет повторную регистрацию с тем же email', async () => {
    const email = nextEmail();
    const body = { email, password: PASSWORD };

    const first = await request(app.getHttpServer())
      .post('/auth/register')
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/auth/register')
      .send(body);

    expect(second.status).toBe(409);
  });

  it('отклоняет невалидный email и короткий пароль', async () => {
    const badEmail = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: PASSWORD });
    expect(badEmail.status).toBe(400);

    const badPassword = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: nextEmail(), password: 'short' });
    expect(badPassword.status).toBe(400);
  });

  it('создаёт таблицу auth.users с нужными колонками', async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
where table_schema = 'auth' and table_name = 'users' order by column_name`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'email',
      'id',
      'password_hash',
    ]);
  });
});
