import type {
  OrganizationInviteDto,
  OrganizationRole,
} from '@docs-app/contracts/organization';

export interface ActorInOrganization {
  organizationId: string;
  actorId: string;
}

export interface AddMemberParams extends ActorInOrganization {
  email: string;
  role: OrganizationRole;
}

export interface CreateOrganizationParams {
  name: string;
  userId: string;
}

export type ListMembersParams = ActorInOrganization;

export type ListInvitesParams = ActorInOrganization;

export interface OrganizationMemberListItem {
  userId: string;
  email: string;
  role: OrganizationRole;
}

// Что уже известно на момент выпуска токена: организацию и приглашающего
// загрузил вызывающий, чтобы письмо не зависело от ещё одного запроса.
export interface IssueInviteParams extends ActorInOrganization {
  email: string;
  role: OrganizationRole;
  organizationName: string;
  inviterEmail: string;
}

// Исходник токена показываем вызывающему один раз: в БД лежит только хеш.
export interface IssuedInvite {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  createdAt: string;
  expiresAt: string;
  token: string;
}

export interface AcceptInviteParams {
  token: string;
  // Принимает только существующий аккаунт; email сверяет сервис.
  userId: string;
}

export interface AcceptedInvite {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
}

export interface RevokeInviteParams extends ActorInOrganization {
  inviteId: string;
}

export interface ResendInviteParams extends ActorInOrganization {
  inviteId: string;
}

export type OrganizationInviteView = OrganizationInviteDto;
