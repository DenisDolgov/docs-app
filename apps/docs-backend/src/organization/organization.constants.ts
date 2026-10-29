import type { OrganizationRole } from '@docs-app/contracts/organization';
import { hoursToMilliseconds } from 'date-fns';

// Роли, которым разрешено управлять участниками. Доменная политика, не wire —
// поэтому живёт на бэкенде, а не в контракте.
const memberManagerRoles = [
  'admin',
  'owner',
] as const satisfies readonly OrganizationRole[];

export const canManageMembers = (role: OrganizationRole): boolean =>
  (memberManagerRoles as readonly OrganizationRole[]).includes(role);

// Срок жизни приглашения: неделя — время, за которое адресат успевает
// зарегистрироваться и открыть ссылку. Домен решает срок, письмо его только
// озвучивает.
export const ORGANIZATION_INVITE_TTL_DAYS = 7;
export const ORGANIZATION_INVITE_TTL = hoursToMilliseconds(
  ORGANIZATION_INVITE_TTL_DAYS * 24,
);
