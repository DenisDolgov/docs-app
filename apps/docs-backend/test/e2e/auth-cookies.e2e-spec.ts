import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { configureApp } from '../../src/app.setup';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '../../src/auth/auth.constants';

const PASSWORD = 'correct horse battery staple';

// Значения нарочно не совпадают с дефолтами: тест ловит и захардкоженные
// атрибуты, и чтение NODE_ENV вместо конфига.
const COOKIE_ENV = {
  COOKIE_SECURE: 'false',
  COOKIE_SAMESITE: 'lax',
  COOKIE_DOMAIN: 'docs.example.test',
} as const;

const findCookie = (res: request.Response, name: string): string | null => {
  const header = res.headers['set-cookie'] as unknown;

  if (Array.isArray(header)) {
    return header.find((cookie) => cookie.startsWith(`${name}=`)) ?? null;
  }

  if (typeof header === 'string' && header.startsWith(`${name}=`)) {
    return header;
  }

  return null;
};

describe('cookie-конфиг (e2e)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  const http = () => request(app.getHttpServer());

  const register = async () => {
    const email = `user-${randomUUID()}@example.com`;

    await http().post('/auth/register').send({ email, password: PASSWORD });

    return email;
  };

  beforeAll(async () => {
    for (const [key, value] of Object.entries(COOKIE_ENV)) {
      vi.stubEnv(key, value);
    }

    // `ConfigModule.forRoot` читает окружение при импорте AppModule, поэтому
    // модуль подгружаем после подмены env. Bootstrap — через общий хелпер,
    // как в приложении и остальных тестах.
    vi.resetModules();
    const { AppModule } = await import('../../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
    vi.unstubAllEnvs();
  });

  it('берёт атрибуты refresh-куки из конфига', async () => {
    const email = await register();

    const res = await http()
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    const refreshCookie = findCookie(res, REFRESH_COOKIE_NAME);

    expect(refreshCookie).toBeTruthy();
    expect(refreshCookie).toMatch(/SameSite=Lax/i);
    expect(refreshCookie).toMatch(/Domain=docs\.example\.test/i);
    expect(refreshCookie).toMatch(/Path=\/auth/i);
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).not.toMatch(/;\s*Secure/i);

    // Конфиг применился не только к Set-Cookie: ротация по этой куке живая.
    const refreshed = await http()
      .post('/auth/refresh')
      .set('Cookie', refreshCookie as string);
    expect(refreshed.status).toBe(200);
  });

  it('не применяет Domain и Secure=false к `__Host-` access-куке', async () => {
    const email = await register();

    const res = await http()
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    const accessCookie = findCookie(res, ACCESS_COOKIE_NAME);

    expect(accessCookie).toBeTruthy();
    // `__Host-` требует Secure, Path=/ и отсутствие Domain — иначе браузер
    // выбросит куку. Эти инварианты сильнее любого env-конфига.
    expect(accessCookie).toMatch(/Secure/i);
    expect(accessCookie).toMatch(/SameSite=Strict/i);
    expect(accessCookie).toMatch(/Path=\//i);
    expect(accessCookie).not.toMatch(/Domain=/i);
  });
});
