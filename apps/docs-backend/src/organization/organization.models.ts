import { OrganizationRole } from '../database/schema/organizations';

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

export interface OrganizationMemberListItem {
  userId: string;
  email: string;
  role: OrganizationRole;
}
