import { z } from 'zod';

export const loginDto = z.object({
  email: z.email(),
  password: z.string(),
});
