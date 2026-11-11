import { documentVersionKinds } from '@docs-app/contracts/document';
import { sql } from 'drizzle-orm';
import {
  bigint,
  customType,
  index,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const byteaUint8Array = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Uint8Array): Buffer {
    return Buffer.from(value);
  },
  fromDriver(value: unknown): Uint8Array {
    if (value instanceof Buffer) {
      return new Uint8Array(value);
    }

    throw new Error('Unsupported driver');
  },
});

export const documentVersionKindEnum = pgEnum(
  'document_version_kind',
  documentVersionKinds,
);

export const collabSchema = snakeCase.schema('collab');

export const documentUpdates = collabSchema.table(
  'document_updates',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    documentId: uuid().notNull(),
    update: byteaUint8Array().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('document_updates_document_id_idx').on(table.documentId, table.id),
  ],
);

export const documentSnapshots = collabSchema.table('document_snapshots', {
  documentId: uuid().primaryKey().notNull(),
  snapshot: byteaUint8Array().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// Версия — снапшот состояния плюс watermark журнала: `updateId` говорит, до
// какого апдейта журнала посчитан снапшот. Без watermark версию нельзя ни
// честно показать, ни восстановить.
export const documentVersions = collabSchema.table(
  'document_versions',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    // FK в чужую схему запрещён правилами: `document.documents` живёт отдельно.
    documentId: uuid().notNull(),
    kind: documentVersionKindEnum().notNull(),
    // Имя есть только у `named`: авто-чекпоинт пользователю показывать нечем.
    name: text(),
    snapshot: byteaUint8Array().notNull(),
    // У чекпоинта автора нет — его пишет сервер.
    createdBy: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updateId: bigint({ mode: 'number' }),
  },
  (table) => [
    // Список истории документа: свежие сверху.
    index('document_versions_document_id_created_at_idx').on(
      table.documentId,
      table.createdAt,
    ),
  ],
);
