import { index, snakeCase, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const documentsSchema = snakeCase.schema('documents');
export const documents = documentsSchema.table(
  'documents',
  {
    id: uuid().primaryKey().defaultRandom(),
    title: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('documents_created_at_idx').on(table.createdAt)],
);
