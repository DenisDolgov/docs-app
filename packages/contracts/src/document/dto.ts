import { z } from 'zod';

export const createDocumentDto = z.object({
  title: z.string().min(1),
});

export const updateDocumentDto = z.object({
  title: z.string().min(1),
});

// Path-параметр: без валидации невалидный uuid уходит в Postgres текстом и
// даёт 500 (22P02) вместо 400.
export const documentIdSchema = z.uuidv7();

export const documentResponseDto = z.object({
  id: z.uuidv7(),
  organizationId: z.uuidv7().nullable(),
  createdBy: z.uuidv7(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CreateDocumentDto = z.infer<typeof createDocumentDto>;
export type UpdateDocumentDto = z.infer<typeof updateDocumentDto>;
export type DocumentDto = z.infer<typeof documentResponseDto>;
