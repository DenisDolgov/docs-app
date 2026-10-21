import type {
  AddMemberDto,
  CreatedOrganizationDto,
  OrganizationMemberDto,
  OrganizationRole,
} from '@docs-app/contracts/organization';
import { organizationRoute } from '@docs-app/contracts/organization/routes';

import { apiJson } from '@/lib/api';

const { paths } = organizationRoute;

// Роль, которую можно выдать при добавлении участника (без `owner`).
export type AssignableOrganizationRole = AddMemberDto['role'];

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
