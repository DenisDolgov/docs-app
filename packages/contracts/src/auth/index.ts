import { z } from 'zod';

// Политика пароля одна для регистрации и сброса.
const passwordSchema = z.string().min(8).max(32);

// `randomBytes(32).toString('base64url')` — ровно 43 символа.
const oneTimeTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const loginDto = z.object({
  email: z.email(),
  password: z.string(),
});

export const registerDto = z.object({
  email: z.email(),
  password: passwordSchema,
});

export const userResponseDto = z.object({
  id: z.uuidv7(),
  email: z.email(),
});

export const verifyEmailDto = z.object({
  token: oneTimeTokenSchema,
});

export const resetPasswordDto = z.object({
  token: oneTimeTokenSchema,
  password: passwordSchema,
});

export const requestPasswordResetDto = z.object({
  email: z.email(),
});

export const meResponseDto = z.object({
  ...userResponseDto.shape,
  emailVerified: z.boolean(),
});

export const sessionResponseDto = z.object({
  id: z.uuid(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
  current: z.boolean(),
});

// Path-параметр: без валидации невалидный uuid уходит в Postgres текстом и
// даёт 500 (22P02) вместо 400.
export const sessionIdSchema = z.uuid();

export type LoginDto = z.infer<typeof loginDto>;
export type RegisterDto = z.infer<typeof registerDto>;
export type VerifyEmailDto = z.infer<typeof verifyEmailDto>;
export type ResetPasswordDto = z.infer<typeof resetPasswordDto>;
export type RequestPasswordResetDto = z.infer<typeof requestPasswordResetDto>;
export type MeResponseDto = z.infer<typeof meResponseDto>;
export type SessionResponseDto = z.infer<typeof sessionResponseDto>;
export type User = z.infer<typeof userResponseDto>;
