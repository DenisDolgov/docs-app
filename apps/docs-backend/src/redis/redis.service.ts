import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS } from './redis.constants';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}
  public set(key: string, value: unknown, ttlSeconds: number) {
    return this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  public async get<T>(key: string): Promise<T | null> {
    const json = await this.redis.get(key);

    if (!json) return null;

    try {
      const data = await JSON.parse(json);

      return data as T;
    } catch (e: unknown) {
      this.logger.error(e);
      return null;
    }
  }

  public del(key: string) {
    return this.redis.del(key);
  }

  public publish(channel: string, payload: unknown) {
    return this.redis.publish(channel, JSON.stringify(payload));
  }
}
