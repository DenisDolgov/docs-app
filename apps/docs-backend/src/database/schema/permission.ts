import { documentAccessLevels } from '@docs-app/contracts/document';
import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  snakeCase,
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
