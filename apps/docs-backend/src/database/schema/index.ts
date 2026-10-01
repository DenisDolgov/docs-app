import { defineRelations } from 'drizzle-orm';

import { documents } from './documents';

export { documents } from './documents';

export const relations = defineRelations({ documents });
