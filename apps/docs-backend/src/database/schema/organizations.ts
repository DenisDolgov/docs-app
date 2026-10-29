import { organizationRoles } from '@docs-app/contracts/organization';
import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Набор ролей — источник истины в контракте (`@docs-app/contracts/organization`),
// `pgEnum` выводится из него, чтобы клиент и БД не разъезжались.
export const organizationRoleEnum = pgEnum(
  'organization_role',
  organizationRoles,
);

export const organizationSchema = snakeCase.schema('organization');

export const organizations = organizationSchema.table('organizations', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = organizationSchema.table(
  'organization_members',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid().notNull(),
    role: organizationRoleEnum().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('member_unique').on(table.organizationId, table.userId),
    index('user_id_idx').on(table.userId),
  ],
);

export const organizationInvites = organizationSchema.table(
  'organization_invites',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    role: organizationRoleEnum().notNull(),
    // В БД только хеш: дамп базы не должен давать рабочие ссылки.
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp({ withTimezone: true }),
    // Повторная отправка гасит прежнее приглашение, но строка остаётся: по ней
    // видно, что приглашение было отозвано, а не потерялось.
    revokedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    // Один живой (не принятый и не отозванный) invite на пару «организация +
    // адрес». Принятые и отозванные строки под индекс не попадают, поэтому
    // история не блокирует повторное приглашение.
    uniqueIndex('organization_invite_live_unique')
      .on(table.organizationId, table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index('organization_invite_organization_id_idx').on(table.organizationId),
    index('organization_invite_expires_at_idx').on(table.expiresAt),
  ],
);
