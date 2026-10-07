import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  await app.listen(configService.get<number>('PORT', 3001));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
