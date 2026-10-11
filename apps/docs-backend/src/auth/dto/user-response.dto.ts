import { z } from 'zod';

export const userResponseDto = z.object({
  id: z.uuidv7(),
  email: z.email(),
});
