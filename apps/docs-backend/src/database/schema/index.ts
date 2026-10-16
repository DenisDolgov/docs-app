import { defineRelations } from 'drizzle-orm';

import { documentSnapshots, documentUpdates } from './collab';
import { documents } from './documents';
import { organizationMembers, organizations } from './organizations';
import { refreshTokens, users } from './users';

export { collabSchema, documentSnapshots, documentUpdates } from './collab';
export { documents, documentsSchema } from './documents';
export {
  organizationMembers,
  organizationRoleEnum,
  organizationSchema,
  organizations,
} from './organizations';
export {
  authSchema,
  type RefreshTokenRevokeReason,
  refreshTokenRevokeReasonEnum,
  refreshTokens,
  users,
} from './users';

export const relations = defineRelations(
  {
    documents,
    users,
    refreshTokens,
    organizations,
    organizationMembers,
    documentUpdates,
    documentSnapshots,
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
