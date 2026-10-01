import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { relations } from './schema';

export const DATABASE = Symbol('DatabaseProvider');

export type Database = NodePgDatabase<typeof relations>;
