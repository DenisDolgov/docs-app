import { MAX_COMMENT_BODY_LENGTH } from '@docs-app/contracts/comment/limits';
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  foreignKey,
  index,
  jsonb,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { CommentAnchor } from '../../comment/comment-anchor';

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

// Комментарий — серверная сущность, а не часть CRDT: тело, авторство и права
// живут в Postgres, якорь лишь ссылается на место в Yjs-документе.
//
// TODO(S1): ограничения и индексы. Третий аргумент оставлен пустым намеренно:
// связи `document_id` и `parent_id`, правило пары `(document_id, parent_id)` и
// индекс списка по документу — твой кусок. После правок сгенерируй миграцию.
export const comments = documentSchema.table(
  'comments',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    documentId: uuid()
      .notNull()
      .references((): AnyPgColumn => documents.id, {
        onDelete: 'cascade',
      }),
    parentId: uuid(),
    authorId: uuid().notNull(),
    body: text().notNull(),
    // Якорь хранится как есть (jsonb): форма провалидирована на входе, но
    // сервер не может проверить позицию без живого документа.
    anchor: jsonb().$type<CommentAnchor | null>(),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'body_max_length',
      sql`LENGTH(${table.body}) <= ${MAX_COMMENT_BODY_LENGTH}`,
    ),
    foreignKey({
      columns: [table.documentId, table.parentId],
      foreignColumns: [table.documentId, table.id],
    }).onDelete('cascade'),
    uniqueIndex('comments_document_idx').on(table.documentId, table.id),
  ],
);
