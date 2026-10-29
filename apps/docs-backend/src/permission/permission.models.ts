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

// Для интерфейса: share без email нечем показать. В горячем пути вычисления
// права (`findByDocumentAndUser`) email не нужен, поэтому join только в списке.
export interface DocumentShareListItem extends DocumentShareView {
  email: string;
}

export interface GrantedDocumentShare extends DocumentShareView {
  email: string;
}

export interface GrantDocumentShareParams {
  documentId: string;
  userId: string;
  role: DocumentAccessLevel;
  actorId: string;
}

export interface GrantDocumentShareByEmailParams {
  documentId: string;
  email: string;
  role: DocumentAccessLevel;
  actorId: string;
}

export interface RevokeDocumentShareParams {
  documentId: string;
  userId: string;
  actorId: string;
}

export interface ListDocumentSharesParams {
  documentId: string;
  actorId: string;
}

// Публичная ссылка. `token` есть только в момент создания: дальше в БД лежит
// хеш, и восстановить исходник нельзя.
export interface PublicLinkView {
  id: string;
  documentId: string;
  role: DocumentAccessLevel;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedPublicLinkView extends PublicLinkView {
  token: string;
}

export interface CreatePublicLinkParams {
  documentId: string;
  actorId: string;
  expiresAt: Date | null;
}

export interface RevokePublicLinkParams {
  documentId: string;
  linkId: string;
  actorId: string;
}

export interface ListPublicLinksParams {
  documentId: string;
  actorId: string;
}

// Строка для проверки ссылки: решение «жива или нет» принимает домен, поэтому
// репозиторий отдаёт сырые сроки и отзыв. `role` не читаем: в v1.0 ссылка
// всегда даёт чтение, и поднимать уровень нечем.
export interface PublicLinkRecord {
  documentId: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface ResolvePublicLinkParams {
  token: string;
}

// Что даёт живая ссылка. Уровень сюда вернётся вместе с write-эндпоинтами по
// ссылке; пока публичный контур умеет только читать.
export interface ResolvedPublicLink {
  documentId: string;
}
