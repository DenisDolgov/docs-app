import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const registerDto = z.object({
  email: z.email(),
  password: z.string().min(8).max(32),
});

export class RegisterDto extends createZodDto(registerDto) {}
