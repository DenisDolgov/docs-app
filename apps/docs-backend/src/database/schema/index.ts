import { defineRelations } from 'drizzle-orm';

import { documentSnapshots, documentUpdates } from './collab';
import { documents } from './documents';
import {
  organizationInvites,
  organizationMembers,
  organizations,
} from './organizations';
import { documentShares, publicLinks } from './permission';
import {
  emailVerificationTokens,
  passwordResetTokens,
  refreshTokens,
  users,
} from './users';

export { collabSchema, documentSnapshots, documentUpdates } from './collab';
export { documents, documentsSchema } from './documents';
export {
  organizationInvites,
  organizationMembers,
  organizationRoleEnum,
  organizationSchema,
  organizations,
} from './organizations';
export {
  documentShareRoleEnum,
  documentShares,
  permissionSchema,
  publicLinks,
} from './permission';
export {
  authSchema,
  emailVerificationTokens,
  passwordResetTokens,
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
    emailVerificationTokens,
    passwordResetTokens,
    organizations,
    organizationMembers,
    documentUpdates,
    documentSnapshots,
    documentShares,
    organizationInvites,
    publicLinks,
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
