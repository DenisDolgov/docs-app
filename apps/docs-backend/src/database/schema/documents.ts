import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  index,
  snakeCase,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const documentSchema = snakeCase.schema('document');

export const folders = documentSchema.table(
  'folders',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    organizationId: uuid().notNull(),
    // Self-FK гарантирует существование родителя, но не запрещает цикл:
    // «папка внутри своего потомка» ловится приложением в транзакции.
    parentId: uuid().references((): AnyPgColumn => folders.id, {
      onDelete: 'restrict',
    }),
    name: text().notNull(),
    createdBy: uuid().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('folders_organization_id_idx').on(table.organizationId),
    index('folders_parent_id_idx').on(table.parentId),
  ],
);

export const documents = documentSchema.table(
  'documents',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    title: text().notNull(),
    // Организация необязательна: личный документ живёт без неё, владелец — `createdBy`.
    organizationId: uuid(),
    // Папки есть только в организациях: личный документ всегда без папки.
    folderId: uuid().references(() => folders.id, { onDelete: 'restrict' }),
    createdBy: uuid().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('documents_created_at_idx').on(table.createdAt),
    index('documents_organization_id_updated_at_idx').on(
      table.organizationId,
      table.updatedAt,
    ),
    index('documents_folder_id_idx').on(table.folderId),
  ],
);
