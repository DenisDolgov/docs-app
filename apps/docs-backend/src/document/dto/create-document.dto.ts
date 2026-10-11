import { z } from 'zod';

export const createDocumentDto = z.object({
  title: z.string().min(1),
});
