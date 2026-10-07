import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { REDIS } from '../../src/redis/redis.constants';
import { RedisService } from '../../src/redis/redis.service';
import { createTestApp } from '../utils';

describe('Redis', () => {
  let redis: Redis;
  let cache: RedisService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    redis = moduleRef.get(REDIS);
    cache = moduleRef.get(RedisService);
    close = () => moduleRef.close();

    await redis.flushdb();
  });

  afterAll(async () => {
    await close();
  });

  it('отвечает на PING', async () => {
    await expect(redis.ping()).resolves.toBe('PONG');
  });

  it('кладет значение и достает его', async () => {
    await cache.set('documents:one', { title: 'Проект' }, 60);

    await expect(cache.get('documents:one')).resolves.toEqual({
      title: 'Проект',
    });
  });

  it('отдает null после истечения TTL', async () => {
    await cache.set('documents:short', { title: 'Черновик' }, 1);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await expect(cache.get('documents:short')).resolves.toBeNull();
  });

  it('удаляет ключ', async () => {
    await cache.set('documents:temp', { title: 'Временный' }, 60);
    await cache.del('documents:temp');

    await expect(cache.get('documents:temp')).resolves.toBeNull();
  });

  it('доставляет сообщение подписчику', async () => {
    const subscriber = redis.duplicate();
    const received = new Promise((resolve) => {
      subscriber.on('message', (_channel, message) => resolve(message));
    });
    await subscriber.subscribe('documents:events');

    await cache.publish('documents:events', { type: 'document:updated' });

    await expect(received).resolves.toBe(
      JSON.stringify({ type: 'document:updated' }),
    );
    await subscriber.quit();
  });
});
