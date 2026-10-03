import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3001),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  RABBITMQ_URL: z.url().default('amqp://user:pass@localhost:5672'),
  S3_ENDPOINT: z.url().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('user'),
  S3_SECRET_KEY: z.string().default('pass-secret'),
});

export type Env = z.infer<typeof envSchema>;
