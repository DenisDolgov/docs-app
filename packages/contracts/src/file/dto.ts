import { z } from 'zod';

import { fileStatuses } from './statuses';

// Path-параметр файла: невалидный uuid уходит в Postgres текстом и даёт 500.
export const fileIdSchema = z.uuidv7();

// Заявка на загрузку: что клиент собирается положить в бакет. Сервер проверяет
// это до подписи, но окончательное решение принимает по фактам объекта после
// `PUT` — поля здесь не доказательство.
export const uploadUrlRequest = z.object({
  filename: z.string().min(1),
  mime: z.string().min(1),
  // Тело никто не читал: это обещание клиента, а не измерение.
  size: z.number().int().positive(),
  documentId: z.uuidv7().optional(),
});

// Ответ на заявку: ссылка с подписью и заголовки, которые обязан отправить
// клиент. `method` фиксирован: ссылка годится только на `PUT`.
export const uploadUrlResponse = z.object({
  fileId: z.uuidv7(),
  url: z.url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
});

export const fileDto = z.object({
  id: z.uuidv7(),
  ownerId: z.uuidv7(),
  organizationId: z.uuidv7().nullable(),
  documentId: z.uuidv7().nullable(),
  name: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  status: z.enum(fileStatuses),
  createdAt: z.iso.datetime(),
});

export const downloadUrlResponse = z.object({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});

// Список вложений всегда привязан к документу: глобального списка файлов нет.
export const listFilesQuery = z.object({
  documentId: z.uuidv7(),
});

export type UploadUrlRequestDto = z.infer<typeof uploadUrlRequest>;
export type UploadUrlResponseDto = z.infer<typeof uploadUrlResponse>;
export type FileDto = z.infer<typeof fileDto>;
export type DownloadUrlResponseDto = z.infer<typeof downloadUrlResponse>;
export type ListFilesQueryDto = z.infer<typeof listFilesQuery>;
