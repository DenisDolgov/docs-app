import { defineRelations } from 'drizzle-orm';

import { documents } from './documents';
import { users } from './users';

export { documents, documentsSchema } from './documents';
export { authSchema, users } from './users';

export const relations = defineRelations({
  documents,
  users,
});
