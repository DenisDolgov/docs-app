import { z } from 'zod';

import { assignableOrganizationRoles, organizationRoles } from './roles';

export const createOrganizationDto = z.object({
  name: z.string().min(1),
});

export const addMemberDto = z.object({
  email: z.email(),
  role: z.enum(assignableOrganizationRoles),
});

// Список организаций пользователя: роль едет вместе с организацией.
export const organizationResponseDto = z.object({
  id: z.uuidv7(),
  name: z.string(),
  role: z.enum(organizationRoles),
});

export const createdOrganizationResponseDto = z.object({
  id: z.uuidv7(),
  name: z.string(),
});

export const organizationMemberResponseDto = z.object({
  userId: z.uuidv7(),
  email: z.email(),
  role: z.enum(organizationRoles),
});

export type CreateOrganizationDto = z.infer<typeof createOrganizationDto>;
export type AddMemberDto = z.infer<typeof addMemberDto>;
export type OrganizationDto = z.infer<typeof organizationResponseDto>;
export type CreatedOrganizationDto = z.infer<
  typeof createdOrganizationResponseDto
>;
export type OrganizationMemberDto = z.infer<
  typeof organizationMemberResponseDto
>;
