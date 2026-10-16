import type { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { Response } from 'supertest';

import { AppModule } from '../src/app.module';
import { ACCESS_COOKIE_NAME } from '../src/auth/auth.constants';

// Access-токен больше не приходит в теле `login`/`refresh` — тесты читают его
// из `Set-Cookie`, как это делает браузер.
export const setCookieHeaders = (res: Response): string[] => {
  const header = res.headers['set-cookie'] as unknown;

  if (Array.isArray(header)) return header as string[];
  if (typeof header === 'string') return [header];

  return [];
};

export const findCookie = (res: Response, name: string) =>
  setCookieHeaders(res).find((cookie) => cookie.startsWith(`${name}=`)) ?? null;

export const cookieValue = (cookie: string) =>
  cookie.split(';')[0].split('=')[1];

export const readAccessToken = (res: Response): string => {
  const cookie = findCookie(res, ACCESS_COOKIE_NAME);

  if (!cookie) {
    throw new Error(`access-cookie ${ACCESS_COOKIE_NAME} не установлена`);
  }

  return cookieValue(cookie);
};

export const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error('waitFor: условие не выполнено за отведённое время');
};

export const createTestingModule = () => {
  return Test.createTestingModule({
    imports: [AppModule],
  }).compile();
};

// Повторяем конфигурацию приложения из `main.ts` (cookie parser + WsAdapter).
// Без адаптера Nest при `init()` пытается поднять драйвер WebSocket по умолчанию
// (`@nestjs/platform-socket.io`, не установлен) и вызывает `process.exit(1)`,
// обрушивая тестовый воркер.
export const configureTestApp = <T extends INestApplication>(app: T): T => {
  app.useWebSocketAdapter(new WsAdapter(app));
  app.use(cookieParser());

  return app;
};

export const createTestApp = async (
  options?: NestApplicationOptions,
): Promise<INestApplication> => {
  const moduleRef = await createTestingModule();

  return configureTestApp(moduleRef.createNestApplication(options));
};
