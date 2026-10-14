import type { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';

import { AppModule } from '../src/app.module';

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
