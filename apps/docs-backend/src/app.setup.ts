import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';
import cookieParser from 'cookie-parser';

// Единый bootstrap HTTP-слоя для `main.ts` и тестов: иначе конфигурация
// cookie-parser и доверия прокси разъедется между приложением и тестами.
export const configureApp = <T extends INestApplication>(app: T): T => {
  app.useWebSocketAdapter(new WsAdapter(app));
  app.use(cookieParser());

  const config = app.get(ConfigService);

  if (config.get<boolean>('TRUST_PROXY')) {
    app.getHttpAdapter().getInstance().set('trust proxy', true);
  }

  return app;
};
