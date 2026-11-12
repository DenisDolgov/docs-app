import { defineRelations } from 'drizzle-orm';

import { auditEvents } from './audit';
import { documentSnapshots, documentUpdates, documentVersions } from './collab';
import { documents, folders } from './documents';
import { fileSchema, fileStatusEnum, files } from './file';
import {
  organizationInvites,
  organizationMembers,
  organizations,
} from './organizations';
import { documentShares, folderShares, publicLinks } from './permission';
import {
  emailVerificationTokens,
  passwordResetTokens,
  refreshTokens,
  users,
} from './users';

export { auditEvents, auditSchema } from './audit';
export {
  collabSchema,
  documentSnapshots,
  documentUpdates,
  documentVersionKindEnum,
  documentVersions,
} from './collab';
export { documentSchema, documents, folders } from './documents';
export { fileSchema, fileStatusEnum, files } from './file';
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
  folderShares,
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
    folders,
    files,
    users,
    refreshTokens,
    emailVerificationTokens,
    passwordResetTokens,
    organizations,
    organizationMembers,
    documentUpdates,
    documentSnapshots,
    documentVersions,
    documentShares,
    folderShares,
    organizationInvites,
    publicLinks,
    auditEvents,
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
