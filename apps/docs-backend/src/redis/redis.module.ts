import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { REDIS } from './redis.constants';
import { RedisService } from './redis.service';

@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redis = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
          lazyConnect: true,
        });

        await redis.connect();

        return redis;
      },
    },
    RedisService,
  ],
  exports: [REDIS, RedisService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
