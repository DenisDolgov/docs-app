import { sql } from 'drizzle-orm';
import { index, snakeCase, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const documentsSchema = snakeCase.schema('documents');
export const documents = documentsSchema.table(
  'documents',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    title: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('documents_created_at_idx').on(table.createdAt)],
);
