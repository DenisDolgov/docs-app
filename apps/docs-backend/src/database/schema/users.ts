import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const authSchema = snakeCase.schema('auth');

// Причина отзыва refresh-токена. Единственный источник истины для перечисления —
// pgEnum; union-тип выводим из него
export const refreshTokenRevokeReasonEnum = pgEnum(
  'refresh_token_revoke_reason',
  ['rotated', 'logout', 'logout_all', 'reuse', 'password_reset'],
);
export type RefreshTokenRevokeReason =
  (typeof refreshTokenRevokeReasonEnum.enumValues)[number];

export const users = authSchema.table('users', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  emailVerifiedAt: timestamp({ withTimezone: true }),
});

export const refreshTokens = authSchema.table(
  'refresh_tokens',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid().notNull(),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp({ withTimezone: true }),
    revokedReason: refreshTokenRevokeReasonEnum(),
    userAgent: text(),
    ip: text(),
    lastUsedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Одна живая строка на сессию: при ротации прежняя строка сначала
    // отзывается, поэтому частичный индекс не мешает цепочке.
    uniqueIndex('refresh_tokens_live_session_uidx')
      .on(table.sessionId)
      .where(sql`${table.revokedAt} is null`),
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_expires_at_idx').on(table.expiresAt),
    index('refresh_tokens_revoked_at_idx').on(table.revokedAt),
  ],
);

export const emailVerificationTokens = authSchema.table(
  'email_verification_tokens',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    userId: uuid().notNull(),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index('email_verification_tokens_user_id_idx').on(table.userId)],
);

export const passwordResetTokens = authSchema.table(
  'password_reset_tokens',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    userId: uuid().notNull(),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index('password_reset_tokens_user_id_idx').on(table.userId)],
);
