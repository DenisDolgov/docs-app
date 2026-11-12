import { fileStatuses } from '@docs-app/contracts/file';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Набор статусов — источник истины в контракте (`@docs-app/contracts/file`).
export const fileStatusEnum = pgEnum('file_status', fileStatuses);

export const fileSchema = snakeCase.schema('file');

// Метаданные объекта, а не сам объект: байты живут в S3, здесь — только то,
// что нужно для списка, проверки прав и уборки.
export const files = fileSchema.table(
  'files',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    ownerId: uuid().notNull(),
    // Организация и документ — необязательные: файл можно загрузить до
    // привязки к документу. Кросс-схемные ссылки запрещены, поэтому голые uuid.
    organizationId: uuid(),
    documentId: uuid(),
    // Ключ генерирует сервер: имя пользователя и расширение в путь не попадают.
    key: text().notNull().unique(),
    // Отображаемое имя — это не путь в бакете и не доверенный ввод.
    name: text().notNull(),
    mime: text().notNull(),
    // После `complete` здесь факт из хранилища, а не заявка клиента.
    size: integer().notNull(),
    status: fileStatusEnum().notNull().default('pending'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('files_size_non_negative', sql`${table.size} >= 0`),
    check('files_key_not_empty', sql`length(${table.key}) > 0`),
    // Список вложений документа.
    index('files_document_id_created_at_idx').on(
      table.documentId,
      table.createdAt,
    ),
    // Уборка брошенных загрузок: выборка по статусу и возрасту.
    index('files_status_created_at_idx').on(table.status, table.createdAt),
    // Личные файлы без документа ищутся по владельцу.
    index('files_owner_id_idx').on(table.ownerId),
  ],
);
