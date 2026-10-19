import { z } from 'zod';

export const loginDto = z.object({
  email: z.email(),
  password: z.string(),
});

export const registerDto = z.object({
  email: z.email(),
  password: z.string().min(8).max(32),
});

export const userResponseDto = z.object({
  id: z.uuidv7(),
  email: z.email(),
});

export const verifyEmailDto = z.object({
  // `randomBytes(32).toString('base64url')` — ровно 43 символа.
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export type LoginDto = z.infer<typeof loginDto>;
export type RegisterDto = z.infer<typeof registerDto>;
export type VerifyEmailDto = z.infer<typeof verifyEmailDto>;
export type User = z.infer<typeof userResponseDto>;
