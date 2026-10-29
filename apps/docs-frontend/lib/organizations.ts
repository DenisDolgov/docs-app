import type {
  AcceptedInviteDto,
  AddMemberDto,
  CreatedOrganizationDto,
  OrganizationInviteDto,
  OrganizationMemberDto,
  OrganizationRole,
} from '@docs-app/contracts/organization';
import {
  inviteRoute,
  organizationRoute,
} from '@docs-app/contracts/organization/routes';

import { apiJson } from '@/lib/api';

const { paths } = organizationRoute;

// Роль, которую можно выдать при добавлении участника (без `owner`).
export type AssignableOrganizationRole = AddMemberDto['role'];

// Единственное место, где роль превращается в текст: списки, диалоги и письма
// не должны обрастать собственными копиями подписей.
export const organizationRoleLabels: Record<OrganizationRole, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  member: 'Участник',
};

export const assignableRoleOptions = [
  { value: 'admin', label: organizationRoleLabels.admin },
  { value: 'member', label: organizationRoleLabels.member },
] as const satisfies readonly {
  value: AssignableOrganizationRole;
  label: string;
}[];

export const createOrganization = (
  name: string,
): Promise<CreatedOrganizationDto> =>
  apiJson<CreatedOrganizationDto>(paths.collection, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

export const listOrganizationMembers = (
  organizationId: string,
): Promise<OrganizationMemberDto[]> =>
  apiJson<OrganizationMemberDto[]>(paths.members(organizationId));

export const addOrganizationMember = ({
  organizationId,
  email,
  role,
}: {
  organizationId: string;
  email: string;
  role: AssignableOrganizationRole;
}): Promise<OrganizationMemberDto> =>
  apiJson<OrganizationMemberDto>(paths.members(organizationId), {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });

// Доменная политика бэкенда: управлять участниками могут owner и admin.
// Здесь она нужна только чтобы не показывать заведомо запрещённую форму;
// последнее слово всё равно за сервером.
export const canManageMembers = (role: OrganizationRole): boolean =>
  role === 'owner' || role === 'admin';

// Приглашение — отдельный контур от `addMember`: получателя может ещё не быть
// в системе, поэтому участник появляется только после принятия по ссылке.
export const inviteOrganizationMember = ({
  organizationId,
  email,
  role,
}: {
  organizationId: string;
  email: string;
  role: AssignableOrganizationRole;
}): Promise<OrganizationInviteDto> =>
  apiJson<OrganizationInviteDto>(paths.invites(organizationId), {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });

export const listOrganizationInvites = (
  organizationId: string,
): Promise<OrganizationInviteDto[]> =>
  apiJson<OrganizationInviteDto[]>(paths.invites(organizationId));

export const resendOrganizationInvite = ({
  organizationId,
  inviteId,
}: {
  organizationId: string;
  inviteId: string;
}): Promise<OrganizationInviteDto> =>
  apiJson<OrganizationInviteDto>(paths.resendInvite(organizationId, inviteId), {
    method: 'POST',
  });

export const revokeOrganizationInvite = ({
  organizationId,
  inviteId,
}: {
  organizationId: string;
  inviteId: string;
}): Promise<void> =>
  apiJson<void>(paths.invite(organizationId, inviteId), {
    method: 'DELETE',
  });

export const acceptOrganizationInvite = (
  token: string,
): Promise<AcceptedInviteDto> =>
  apiJson<AcceptedInviteDto>(inviteRoute.paths.accept, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
