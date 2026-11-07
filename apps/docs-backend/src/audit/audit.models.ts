import type { AuditAction, AuditTargetType } from './audit.actions';

export type AuditMetadata = Record<string, unknown>;

export interface AuditEventParams {
  actorId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata?: AuditMetadata;
  ip?: string | null;
  userAgent?: string | null;
}
