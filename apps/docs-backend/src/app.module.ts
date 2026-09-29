import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { envSchema } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { createLoggerParams } from './logger/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envSchema,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createLoggerParams(config),
    }),
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
