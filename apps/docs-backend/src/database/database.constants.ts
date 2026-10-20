import type {
  NodePgDatabase,
  NodePgQueryResultHKT,
} from 'drizzle-orm/node-postgres';
import type { PgAsyncDatabase } from 'drizzle-orm/pg-core';

import type { relations } from './schema';

export const DATABASE = Symbol('DatabaseProvider');

export type Database = NodePgDatabase<typeof relations>;

// Общий тип для `db` и `tx`: в Drizzle `NodePgTransaction` и `NodePgDatabase`
// наследуются от `PgAsyncDatabase`, поэтому репозитории могут принимать
// открытую транзакцию, не зная, с чем именно их вызвали.
export type DbExecutor = PgAsyncDatabase<
  NodePgQueryResultHKT,
  typeof relations
>;
