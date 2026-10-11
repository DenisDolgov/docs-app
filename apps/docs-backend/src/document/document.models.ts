import { ActorInOrganization } from '../organization/organization.models';

// todo можно ли использовать typeof schema.documents.$inferSelect за основу???
export interface DocumentView {
  id: string;
  organizationId: string;
  createdBy: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentParams extends ActorInOrganization {
  title: string;
}

export type GetOrganizationDocumentsParams = ActorInOrganization;

export interface GetDocumentParams extends ActorInOrganization {
  documentId: string;
}

export interface UpdateDocumentParams extends ActorInOrganization {
  documentId: string;
  title: string;
}

export interface RemoveDocumentParams extends ActorInOrganization {
  documentId: string;
}
