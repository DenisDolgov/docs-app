// Маршруты организации. `base`/`param`/`membersPattern` — для бэкенд-декораторов,
// `paths` — полные пути для клиента.
const base = 'organizations';
const param = 'organizationId';
const membersSegment = 'members';
const invitesSegment = 'invites';
const inviteParam = 'inviteId';

export const organizationRoute = {
  base,
  param,
  membersPattern: `/:${param}/${membersSegment}`,
  invitesPattern: `/:${param}/${invitesSegment}`,
  invitePattern: `/:${param}/${invitesSegment}/:${inviteParam}`,
  inviteResendPattern: `/:${param}/${invitesSegment}/:${inviteParam}/resend`,
  inviteParam,
  paths: {
    collection: `/${base}`,
    members: (organizationId: string) =>
      `/${base}/${organizationId}/${membersSegment}`,
    invites: (organizationId: string) =>
      `/${base}/${organizationId}/${invitesSegment}`,
    invite: (organizationId: string, inviteId: string) =>
      `/${base}/${organizationId}/${invitesSegment}/${inviteId}`,
    resendInvite: (organizationId: string, inviteId: string) =>
      `/${base}/${organizationId}/${invitesSegment}/${inviteId}/resend`,
  },
} as const;

// Принятие приглашения не привязано к организации в пути: организация и роль
// берутся из самого приглашения.
const acceptSegment = 'accept';

export const inviteRoute = {
  base: invitesSegment,
  acceptSegment,
  paths: {
    accept: `/${invitesSegment}/${acceptSegment}`,
  },
} as const;
