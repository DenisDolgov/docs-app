import { z } from 'zod';

export const updateDocumentDto = z.object({
  title: z.string().min(1),
});
