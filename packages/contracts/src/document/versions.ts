import { z } from 'zod';

// Вид версии — источник для `pgEnum` в `database/schema/collab.ts`.
// `checkpoint` пишет сервер по порогу, `named` создаёт пользователь.
export const documentVersionKinds = ['checkpoint', 'named'] as const;
export type DocumentVersionKind = (typeof documentVersionKinds)[number];

export const createDocumentVersionDto = z.object({
  name: z.string().trim().min(1).max(120),
});

export const documentVersionIdSchema = z.uuidv7();

// Наружу уходят только метаданные: байты снапшота клиенту не нужны, а лишний
// объём и риск утечки содержимого — не нужны тем более.
export const documentVersionResponseDto = z.object({
  id: z.uuidv7(),
  documentId: z.uuidv7(),
  kind: z.enum(documentVersionKinds),
  name: z.string().nullable(),
  createdBy: z.uuidv7().nullable(),
  createdAt: z.iso.datetime(),
  updateId: z.number().int().nonnegative().nullable(),
});

export type CreateDocumentVersionDto = z.infer<typeof createDocumentVersionDto>;
export type DocumentVersionDto = z.infer<typeof documentVersionResponseDto>;
