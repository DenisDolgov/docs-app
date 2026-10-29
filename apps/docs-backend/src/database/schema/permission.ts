import { documentAccessLevels } from '@docs-app/contracts/document';
import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const documentShareRoleEnum = pgEnum(
  'document_share_role',
  documentAccessLevels,
);

export const permissionSchema = snakeCase.schema('permission');

export const documentShares = permissionSchema.table(
  'document_shares',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    documentId: uuid().notNull(),
    userId: uuid().notNull(),
    role: documentShareRoleEnum().notNull(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Одна строка на пару «документ + пользователь»: повторный grant — это
    // смена роли, а не вторая запись.
    unique('document_share_unique').on(table.documentId, table.userId),
    // Для списка доступных документов: поиск share'ов по пользователю.
    index('document_share_user_id_idx').on(table.userId),
  ],
);

// Публичная ссылка — capability: доступ получает любой, у кого токен. Поэтому
// в БД только хеш. `role` — задел: в v1.0 ссылка всегда даёт чтение, домен
// уровень из строки не читает (см. `PublicLinkResolver`). Строка не удаляется
// при отзыве: отозванная и просроченная ссылки неразличимы снаружи (обе 404).
export const publicLinks = permissionSchema.table(
  'public_links',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    documentId: uuid().notNull(),
    tokenHash: text().notNull().unique(),
    role: documentShareRoleEnum().notNull().default('viewer'),
    expiresAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Список ссылок документа и уборка: сам поиск идёт по unique(token_hash).
    index('public_link_document_id_idx').on(table.documentId),
    index('public_link_expires_at_idx').on(table.expiresAt),
  ],
);
