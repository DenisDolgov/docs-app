import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { setupOpenApi } from './openapi/setup-openapi';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  app.useLogger(app.get(Logger));
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
