import { z } from 'zod';

export const envSchema = z
  .object({
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
    APP_URL: z.url().default('http://localhost:3000'),
    // Атрибуты refresh-куки. Access-кука с префиксом `__Host-` их игнорирует.
    COOKIE_SECURE: z.stringbool().default(true),
    COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    COOKIE_DOMAIN: z.string().min(1).optional(),
    TRUST_PROXY: z.stringbool().default(false),
  })
  .superRefine((env, ctx) => {
    // Браузер проигнорирует SameSite=None без Secure
    if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SAMESITE=none требует COOKIE_SECURE=true',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
