import { z } from 'zod';

import { documentAccessLevels } from './access';

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

// Share — прямой доступ конкретному аккаунту. Наружу отдаём email, а не только
// userId: интерфейсу нечем показать uuid.
export const grantDocumentShareDto = z.object({
  email: z.email(),
  role: z.enum(documentAccessLevels),
});

export const documentShareResponseDto = z.object({
  id: z.uuidv7(),
  documentId: z.uuidv7(),
  userId: z.uuidv7(),
  email: z.email(),
  role: z.enum(documentAccessLevels),
  createdAt: z.iso.datetime(),
});

export const shareUserIdSchema = z.uuidv7();

// Публичная ссылка: `expiresAt` необязателен — без него ссылка живёт до отзыва.
export const createPublicLinkDto = z.object({
  expiresAt: z.iso.datetime().nullish(),
});

export const publicLinkIdSchema = z.uuidv7();

export const publicLinkResponseDto = z.object({
  id: z.uuidv7(),
  documentId: z.uuidv7(),
  role: z.enum(documentAccessLevels),
  expiresAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

// Plaintext токена показываем один раз — в ответе на создание. В списке его
// нет: из БД его достать нельзя, там только хеш.
export const createdPublicLinkResponseDto = publicLinkResponseDto.extend({
  token: z.string(),
});

export const publicLinkTokenSchema = z.string().min(1).max(512);

// Публичная страница не отдаёт служебные поля доступа: у анонима нет ни
// аккаунта, ни роли, ему нужен только документ.
export const publicDocumentResponseDto = z.object({
  id: z.uuidv7(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type GrantDocumentShareDto = z.infer<typeof grantDocumentShareDto>;
export type DocumentShareDto = z.infer<typeof documentShareResponseDto>;
export type CreatePublicLinkDto = z.infer<typeof createPublicLinkDto>;
export type PublicLinkDto = z.infer<typeof publicLinkResponseDto>;
export type CreatedPublicLinkDto = z.infer<typeof createdPublicLinkResponseDto>;
export type PublicDocumentDto = z.infer<typeof publicDocumentResponseDto>;
