import { sql } from 'drizzle-orm';
import { snakeCase, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const authSchema = snakeCase.schema('auth');
export const users = authSchema.table('users', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
