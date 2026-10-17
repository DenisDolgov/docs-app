import type { OrganizationRole } from '@docs-app/contracts/organization';

// Роли, которым разрешено управлять участниками. Доменная политика, не wire —
// поэтому живёт на бэкенде, а не в контракте.
const memberManagerRoles = [
  'admin',
  'owner',
] as const satisfies readonly OrganizationRole[];

export const canManageMembers = (role: OrganizationRole): boolean =>
  (memberManagerRoles as readonly OrganizationRole[]).includes(role);
