import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('POST /auth/register', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    app = moduleRef.createNestApplication();
    await app.init();
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

  it('нормализует email при регистрации: возвращает в нижнем регистре', async () => {
    const email = nextEmail();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: email.toUpperCase(), password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);
  });

  it('отклоняет повторную регистрацию того же email в другом регистре', async () => {
    const email = nextEmail();

    const first = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: email.toUpperCase(), password: PASSWORD });

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
});
