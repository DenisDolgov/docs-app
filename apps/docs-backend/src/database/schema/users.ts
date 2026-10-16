import { sql } from 'drizzle-orm';
import { pgEnum, snakeCase, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const authSchema = snakeCase.schema('auth');

// Причина отзыва refresh-токена. Единственный источник истины для перечисления —
// pgEnum; union-тип выводим из него (см. AGENTS бэкенда).
export const refreshTokenRevokeReasonEnum = pgEnum(
  'refresh_token_revoke_reason',
  ['rotated', 'logout', 'logout_all', 'reuse'],
);
export type RefreshTokenRevokeReason =
  (typeof refreshTokenRevokeReasonEnum.enumValues)[number];

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
  revokedReason: refreshTokenRevokeReasonEnum(),
});
