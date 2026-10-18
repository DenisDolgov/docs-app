import { Module, StandardSchemaSerializerInterceptor } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { AppValidationPipe } from './common/app-validation.pipe';
import { OriginGuard } from './common/origin.guard';
import { envSchema } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { DocumentModule } from './document/document.module';
import { HealthModule } from './health/health.module';
import { createLoggerParams } from './logger/logger.config';
import { MailModule } from './mail/mail.module';
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
    MailModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_PIPE,
      useClass: AppValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StandardSchemaSerializerInterceptor,
    },
  ],
})
export class AppModule {}
