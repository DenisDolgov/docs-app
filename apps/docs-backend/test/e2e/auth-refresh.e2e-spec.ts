import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { REFRESH_COOKIE_NAME } from '../../src/auth/auth.constants';
import { createTestApp } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

const setCookies = (res: request.Response): string[] => {
  const header = res.headers['set-cookie'] as unknown;

  if (Array.isArray(header)) return header as string[];
  if (typeof header === 'string') return [header];

  return [];
};

const findCookie = (res: request.Response, name: string) =>
  setCookies(res).find((cookie) => cookie.startsWith(`${name}=`)) ?? null;

const cookieValue = (cookie: string) => cookie.split(';')[0].split('=')[1];

const expectRefreshCookieCleared = (res: request.Response) => {
  const cleared = findCookie(res, REFRESH_COOKIE_NAME);
  expect(cleared).toBeTruthy();
  // Express clearCookie ставит пустое значение и Expires в прошлом,
  // Max-Age при удалении не пишется.
  expect(cookieValue(cleared as string)).toBe('');
  expect(cleared).toMatch(/Path=\/auth/i);
  expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
};

describe('refresh-токены', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    return email;
  };

  const login = async () => {
    const email = await register();

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    return {
      email,
      accessToken: res.body.accessToken as string,
      refreshCookie: findCookie(res, REFRESH_COOKIE_NAME),
    };
  };

  const refresh = (cookie: string) =>
    request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie);

  const logout = (cookie: string) =>
    request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie);

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('логин устанавливает httpOnly refresh-cookie', async () => {
    const { refreshCookie } = await login();

    expect(refreshCookie).toBeTruthy();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Path=\/auth/i);
    expect(refreshCookie).toMatch(/Max-Age=[1-9]/i);
  });

  it('refresh выдаёт новый access-токен и ротирует refresh-токен', async () => {
    const { refreshCookie } = await login();
    const first = cookieValue(refreshCookie as string);

    const res = await refresh(refreshCookie as string);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ accessToken: expect.any(String) });

    const rotated = findCookie(res, REFRESH_COOKIE_NAME);
    expect(rotated).toBeTruthy();
    expect(cookieValue(rotated as string)).not.toBe(first);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);

    expect(me.status).toBe(200);
  });

  it('отклоняет уже использованный refresh-токен', async () => {
    const { refreshCookie } = await login();
    const first = refreshCookie as string;

    const rotated = await refresh(first);
    expect(rotated.status).toBe(200);

    const reused = await refresh(first);

    expect(reused.status).toBe(401);
  });

  it('при повторном использовании отзывает всю сессию', async () => {
    const { refreshCookie } = await login();
    const first = refreshCookie as string;

    const rotated = await refresh(first);
    const second = findCookie(rotated, REFRESH_COOKIE_NAME) as string;
    expect(second).toBeTruthy();

    const reused = await refresh(first);
    expect(reused.status).toBe(401);

    const afterReuse = await refresh(second);

    expect(afterReuse.status).toBe(401);
  });

  it('отвечает 401 на refresh без cookie', async () => {
    const res = await request(app.getHttpServer()).post('/auth/refresh');

    expect(res.status).toBe(401);
  });

  it('отвечает 401 на неизвестный refresh-токен', async () => {
    const forged = randomBytes(32).toString('base64url');

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${forged}`);

    expect(res.status).toBe(401);
  });

  it('logout очищает refresh-cookie', async () => {
    const { refreshCookie } = await login();

    const res = await logout(refreshCookie as string);

    expect(res.status).toBeLessThan(400);
    expectRefreshCookieCleared(res);
  });

  it('logout идемпотентен без cookie', async () => {
    const res = await request(app.getHttpServer()).post('/auth/logout');

    expect(res.status).toBeLessThan(400);
    expectRefreshCookieCleared(res);
  });

  it('logout идемпотентен с неизвестным refresh-токеном', async () => {
    const forged = randomBytes(32).toString('base64url');

    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${forged}`);

    expect(res.status).toBeLessThan(400);
    expectRefreshCookieCleared(res);
  });

  it('logout-all идемпотентен без cookie', async () => {
    const res = await request(app.getHttpServer()).post('/auth/logout-all');

    expect(res.status).toBeLessThan(400);
    expectRefreshCookieCleared(res);
  });

  it('после logout refresh-токен больше не работает', async () => {
    const { refreshCookie } = await login();
    const cookie = refreshCookie as string;

    await logout(cookie);

    const res = await refresh(cookie);

    expect(res.status).toBe(401);
  });

  it('logout-all отзывает все сессии пользователя', async () => {
    const email = await register();

    const firstLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });
    const secondLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    const first = findCookie(firstLogin, REFRESH_COOKIE_NAME) as string;
    const second = findCookie(secondLogin, REFRESH_COOKIE_NAME) as string;

    const res = await request(app.getHttpServer())
      .post('/auth/logout-all')
      .set('Cookie', first);

    expect(res.status).toBeLessThan(400);

    const firstAfter = await refresh(first);
    const secondAfter = await refresh(second);

    expect(firstAfter.status).toBe(401);
    expect(secondAfter.status).toBe(401);
  });
});
