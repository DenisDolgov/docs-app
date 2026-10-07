import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '../utils';

const PASSWORD = 'correct horse battery staple';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('POST /auth/login', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    return email;
  };

  const login = (email: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/auth/login').send({ email, password });

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('выдаёт access-токен на верные email и пароль', async () => {
    const email = await register();

    const res = await login(email);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ accessToken: expect.any(String) });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('отвечает 401 на неверный пароль', async () => {
    const email = await register();

    const res = await login(email, 'definitely-wrong-password');

    expect(res.status).toBe(401);
  });

  it('отвечает 401 на незарегистрированный email', async () => {
    const res = await login(nextEmail());

    expect(res.status).toBe(401);
  });

  it('логин регистронезависим: входит по email в другом регистре', async () => {
    const email = await register();

    const res = await login(email.toUpperCase());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ accessToken: expect.any(String) });
  });

  it('отвечает 400 на невалидное тело', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me', () => {
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

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    app = moduleRef.createNestApplication();
    await app.init();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('возвращает пользователя по access-токену', async () => {
    const { email, accessToken } = await registerAndLogin();

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: expect.any(String), email });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('отвечает 401 без заголовка Authorization', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');

    expect(res.status).toBe(401);
  });

  it('отвечает 401 на токен, подписанный чужим секретом', async () => {
    const { email } = await registerAndLogin();
    const forged = new JwtService({ secret: 'not-the-access-secret' }).sign({
      sub: randomUUID(),
      email,
    });

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('отвечает 401 на истёкший токен', async () => {
    const { email } = await registerAndLogin();
    const expired = new JwtService({ secret: ACCESS_SECRET }).sign({
      sub: randomUUID(),
      email,
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });
});
