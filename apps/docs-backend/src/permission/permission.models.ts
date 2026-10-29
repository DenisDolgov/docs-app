import type { DocumentAccessLevel } from '@docs-app/contracts/document';

// Эффективное право на документ: три уровня share плюс вычисляемый `owner`.
// Владелец не хранится строкой в `permission.document_shares` — он выводится из
// документа и роли в организации, поэтому живёт только здесь.
export type EffectiveAccessLevel = DocumentAccessLevel | 'owner';

export interface AccessPrincipal {
  userId: string;
}

// Вход вычисления права: документ + тот, чьё право считаем.
export interface ResolveAccessParams {
  documentId: string;
  principal: AccessPrincipal;
}

export interface DocumentAccessParams {
  documentId: string;
  principal: AccessPrincipal;
}

export interface AssertDocumentAccessParams extends DocumentAccessParams {
  // Требование может быть и вычисляемым `owner` — например, для управления
  // составом share.
  required: EffectiveAccessLevel;
}

export interface CacheDocumentAccessParams extends DocumentAccessParams {
  level: EffectiveAccessLevel | null;
}

export interface CacheDocumentAccessKey {
  documentId: string;
  principalId: string;
}

// Минимум сведений о документе, нужный политике. Отдельно от `DocumentView`:
// политике не нужны title и даты, а документу — не нужны правила доступа.
export interface DocumentAccessFacts {
  organizationId: string | null;
  createdBy: string;
}

export interface DocumentShareView {
  id: string;
  documentId: string;
  userId: string;
  role: DocumentAccessLevel;
  createdBy: string;
  createdAt: string;
}

export interface GrantDocumentShareParams {
  documentId: string;
  userId: string;
  role: DocumentAccessLevel;
  actorId: string;
}

export interface RevokeDocumentShareParams {
  documentId: string;
  userId: string;
  actorId: string;
}
