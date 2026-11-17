import { z } from 'zod';

import {
  MAX_COMMENT_ANCHOR_POSITION_LENGTH,
  MAX_COMMENT_ANCHOR_QUOTE_LENGTH,
  MAX_COMMENT_BODY_LENGTH,
} from './limits';

// Якорь приходит от клиента: два конца выделения в CRDT и текст фрагмента.
// `start`/`end` — Yjs relative position в base64, а не абсолютные offset'ы:
// `z.base64()` отсекает мусор по форме, а то, что байты вообще декодируются в
// relative position, проверяет сервер.
export const commentAnchorDto = z.object({
  start: z.base64().min(1).max(MAX_COMMENT_ANCHOR_POSITION_LENGTH),
  end: z.base64().min(1).max(MAX_COMMENT_ANCHOR_POSITION_LENGTH),
  quote: z.string().min(1).max(MAX_COMMENT_ANCHOR_QUOTE_LENGTH),
});

// Path-параметр комментария: невалидный uuid иначе дойдёт до Postgres и даст
// 500 вместо 400.
export const commentIdSchema = z.uuidv7();

export const createCommentDto = z.object({
  body: z.string().trim().min(1).max(MAX_COMMENT_BODY_LENGTH),
  // Ответ — только в корень: `parentId` не может указывать на ответ.
  parentId: z.uuidv7().optional(),
  anchor: commentAnchorDto.optional(),
});

export const updateCommentDto = z.object({
  body: z.string().trim().min(1).max(MAX_COMMENT_BODY_LENGTH),
});

export const commentResponseDto = z.object({
  id: z.uuidv7(),
  documentId: z.uuidv7(),
  parentId: z.uuidv7().nullable(),
  authorId: z.uuidv7(),
  body: z.string(),
  anchor: commentAnchorDto.nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// Что интерфейс вправе показать: право считается сервером по эффективному
// уровню документа, клиент его не угадывает по роли share.
export const commentAccessDto = z.object({
  canComment: z.boolean(),
  canResolve: z.boolean(),
});

// Дерево отдаётся плоским списком: корень и ответы различаются `parentId`.
// Вместе с ним едет `access`, чтобы панель не делала второй запрос за правами.
export const commentListResponseDto = z.object({
  items: z.array(commentResponseDto),
  access: commentAccessDto,
});

export type CommentAnchorDto = z.infer<typeof commentAnchorDto>;
export type CreateCommentDto = z.infer<typeof createCommentDto>;
export type UpdateCommentDto = z.infer<typeof updateCommentDto>;
export type CommentDto = z.infer<typeof commentResponseDto>;
export type CommentAccessDto = z.infer<typeof commentAccessDto>;
export type CommentListResponseDto = z.infer<typeof commentListResponseDto>;
