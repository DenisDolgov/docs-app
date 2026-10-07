import { sql } from 'drizzle-orm';
import { snakeCase, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const authSchema = snakeCase.schema('auth');

export const users = authSchema.table('users', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = authSchema.table('refresh_tokens', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  userId: uuid().notNull(),
  sessionId: uuid().notNull(),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp({ withTimezone: true }),
});
