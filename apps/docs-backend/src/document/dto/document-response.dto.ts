import { z } from 'zod';

export const documentResponseDto = z.object({
  id: z.uuidv7(),
  organizationId: z.uuidv7(),
  createdBy: z.uuidv7(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
