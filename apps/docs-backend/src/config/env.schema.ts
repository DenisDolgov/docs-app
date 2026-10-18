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
  JWT_ACCESS_SECRET: z.string().min(16),
  CORS_ORIGIN: z.url().default('http://localhost:3000'),
  MAIL_TRANSPORT: z.enum(['smtp', 'log']).default('smtp'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().min(1).max(65535).default(1025),
  SMTP_FROM: z.string().default('Docs <noreply@docs.local>'),
});

export type Env = z.infer<typeof envSchema>;
