import { defineRelations } from 'drizzle-orm';

import { documents } from './documents';
import { refreshTokens, users } from './users';

export { documents, documentsSchema } from './documents';
export { authSchema, refreshTokens, users } from './users';

export const relations = defineRelations({
  documents,
  users,
  refreshTokens,
});
