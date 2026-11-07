// Наборы действий и типов цели живут в модуле, а не в контракте: у audit в
// v1.0 нет HTTP/WS-границы. Столбцы в БД текстовые, поэтому новый тип события
// не требует миграции.
export const auditActions = [
  'auth.login',
  'auth.logout',
  'auth.logout_all',
  'auth.email_verified',
  'auth.password_reset',
  'organization.created',
  'organization_invite.issued',
  'organization_invite.revoked',
  'organization_invite.accepted',
  'document.removed',
  'document_share.granted',
  'document_share.revoked',
  'public_link.created',
  'public_link.revoked',
] as const;

export type AuditAction = (typeof auditActions)[number];

export const auditTargetTypes = ['user', 'organization', 'document'] as const;

export type AuditTargetType = (typeof auditTargetTypes)[number];
