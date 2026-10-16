import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { setupOpenApi } from './openapi/setup-openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();
  setupOpenApi(app);
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
    credentials: true,
  });
  await app.listen(configService.get<number>('PORT', 3001));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
