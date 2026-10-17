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

export type LoginDto = z.infer<typeof loginDto>;
export type RegisterDto = z.infer<typeof registerDto>;
export type User = z.infer<typeof userResponseDto>;
