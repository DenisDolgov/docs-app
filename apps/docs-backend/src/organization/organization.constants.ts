import { type OrganizationRole } from '../database/schema/organizations';

// Роли, которые можно выдать приглашением (owner — только через передачу владения).
export const assignableOrganizationRoles = [
  'admin',
  'member',
] as const satisfies readonly OrganizationRole[];

// Роли, которым разрешено управлять участниками.
const memberManagerRoles = [
  'admin',
  'owner',
] as const satisfies readonly OrganizationRole[];

export const canManageMembers = (role: OrganizationRole): boolean =>
  (memberManagerRoles as readonly OrganizationRole[]).includes(role);
