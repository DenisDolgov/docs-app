import {
  bigint,
  customType,
  index,
  snakeCase,
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
