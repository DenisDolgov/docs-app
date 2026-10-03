import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3001),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  RABBITMQ_URL: z.url().default('amqp://user:pass@localhost:5672'),
});

export type Env = z.infer<typeof envSchema>;
