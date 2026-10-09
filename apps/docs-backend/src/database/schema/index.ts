import { defineRelations } from 'drizzle-orm';

import { documents } from './documents';
import { organizationMembers, organizations } from './organizations';
import { refreshTokens, users } from './users';

export { documents, documentsSchema } from './documents';
export {
  organizationMembers,
  organizationRoleEnum,
  organizationSchema,
  organizations,
} from './organizations';
export { authSchema, refreshTokens, users } from './users';

export const relations = defineRelations(
  {
    documents,
    users,
    refreshTokens,
    organizations,
    organizationMembers,
  },
  (r) => ({
    organizationMembers: {
      organization: r.one.organizations({
        from: r.organizationMembers.organizationId,
        to: r.organizations.id,
      }),
    },
  }),
);
