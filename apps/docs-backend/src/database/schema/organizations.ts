import { sql } from 'drizzle-orm';
import {
  index,
  pgEnum,
  snakeCase,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const organizationRoleEnum = pgEnum('organization_role', [
  'owner',
  'admin',
  'member',
]);

export type OrganizationRole = (typeof organizationRoleEnum.enumValues)[number];

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
