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

export type LoginDto = z.infer<typeof loginDto>;
export type RegisterDto = z.infer<typeof registerDto>;
export type VerifyEmailDto = z.infer<typeof verifyEmailDto>;
export type ResetPasswordDto = z.infer<typeof resetPasswordDto>;
export type RequestPasswordResetDto = z.infer<typeof requestPasswordResetDto>;
export type User = z.infer<typeof userResponseDto>;
