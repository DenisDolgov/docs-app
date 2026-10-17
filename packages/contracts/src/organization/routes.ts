// Маршруты организации. `base`/`param`/`membersPattern` — для бэкенд-декораторов,
// `paths` — полные пути для клиента.
const base = 'organizations';
const param = 'organizationId';
const membersSegment = 'members';

export const organizationRoute = {
  base,
  param,
  membersPattern: `/:${param}/${membersSegment}`,
  paths: {
    collection: `/${base}`,
    members: (organizationId: string) =>
      `/${base}/${organizationId}/${membersSegment}`,
  },
} as const;
