import { ActorInOrganization } from '../organization/organization.models';

export interface DocumentView {
  id: string;
  organizationId: string | null;
  createdBy: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// Создание документа в организации (требует членства).
export interface CreateDocumentParams extends ActorInOrganization {
  title: string;
}

// Создание личного документа (владелец = автор).
export interface CreatePersonalDocumentParams {
  actorId: string;
  title: string;
}

// Арендный список организации.
export type GetOrganizationDocumentsParams = ActorInOrganization;

// Список всех документов, к которым у пользователя есть доступ.
export interface ListAccessibleDocumentsParams {
  actorId: string;
}

// Единый контур одного документа: доступ = владелец или член организации.
export interface GetDocumentParams {
  actorId: string;
  documentId: string;
}

export interface UpdateDocumentParams extends GetDocumentParams {
  title: string;
}

export type RemoveDocumentParams = GetDocumentParams;
