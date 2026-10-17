// Единственный источник истины для роли в организации — контракт.
// Схема БД (`database/schema/organizations.ts`) строит `pgEnum` из этого набора.
export const organizationRoles = ['owner', 'admin', 'member'] as const;

export type OrganizationRole = (typeof organizationRoles)[number];

// Роли, которые можно выдать приглашением (owner — только через передачу владения).
export const assignableOrganizationRoles = [
  'admin',
  'member',
] as const satisfies readonly OrganizationRole[];
