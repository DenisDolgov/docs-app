import {
  Module,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { OriginGuard } from './common/origin.guard';
import { envSchema } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { DocumentModule } from './document/document.module';
import { HealthModule } from './health/health.module';
import { createLoggerParams } from './logger/logger.config';
import { OrganizationModule } from './organization/organization.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';

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
    DatabaseModule,
    RedisModule,
    RabbitmqModule,
    StorageModule,
    HealthModule,
    AuthModule,
    OrganizationModule,
    DocumentModule,
    CollabModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_PIPE,
      useClass: StandardSchemaValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StandardSchemaSerializerInterceptor,
    },
  ],
})
export class AppModule {}
