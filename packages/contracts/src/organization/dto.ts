import { z } from 'zod';

import { assignableOrganizationRoles, organizationRoles } from './roles';

export const createOrganizationDto = z.object({
  name: z.string().min(1),
});

export const addMemberDto = z.object({
  email: z.email(),
  role: z.enum(assignableOrganizationRoles),
});

// Path-параметр: без валидации невалидный uuid уходит в Postgres текстом и
// даёт 500 (22P02) вместо 400.
export const organizationIdSchema = z.uuidv7();

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

// Приглашение по email: получателя может ещё не быть в системе, поэтому
// приглашение ждёт регистрации, а не создаёт пользователя.
export const createInviteDto = z.object({
  email: z.email(),
  role: z.enum(assignableOrganizationRoles),
});

export const inviteIdSchema = z.uuidv7();

export const organizationInviteResponseDto = z.object({
  id: z.uuidv7(),
  organizationId: z.uuidv7(),
  email: z.email(),
  role: z.enum(organizationRoles),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  acceptedAt: z.iso.datetime().nullable(),
});

// Принятие — по одноразовому токену из письма; ссылка ведёт на фронт, а фронт
// присылает токен сюда вместе с активной сессией.
export const acceptInviteDto = z.object({
  token: z.string().min(1).max(512),
});

export const acceptedInviteResponseDto = z.object({
  organizationId: z.uuidv7(),
  organizationName: z.string(),
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
export type CreateInviteDto = z.infer<typeof createInviteDto>;
export type AcceptInviteDto = z.infer<typeof acceptInviteDto>;
export type OrganizationInviteDto = z.infer<
  typeof organizationInviteResponseDto
>;
export type AcceptedInviteDto = z.infer<typeof acceptedInviteResponseDto>;
