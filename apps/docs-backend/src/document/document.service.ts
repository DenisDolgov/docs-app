import { Injectable, NotFoundException } from '@nestjs/common';

import { ORGANIZATION_NOT_FOUND_ERROR } from '../organization/errors';
import { OrganizationMemberRepository } from '../organization/organization-member.repository';
import {
  CreateDocumentParams,
  CreatePersonalDocumentParams,
  GetDocumentParams,
  GetOrganizationDocumentsParams,
  ListAccessibleDocumentsParams,
  RemoveDocumentParams,
  UpdateDocumentParams,
} from './document.models';
import { DocumentRepository } from './document.repository';
import { DOCUMENT_NOT_FOUND_ERROR } from './errors';

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
  ) {}

  public async createInOrganization({
    organizationId,
    actorId,
    title,
  }: CreateDocumentParams) {
    await this.assertActorMember(organizationId, actorId);

    return await this.documentRepository.create({
      organizationId,
      createdBy: actorId,
      title,
    });
  }

  public async createPersonal({
    actorId,
    title,
  }: CreatePersonalDocumentParams) {
    return await this.documentRepository.create({
      createdBy: actorId,
      title,
    });
  }

  public async listInOrganization({
    organizationId,
    actorId,
  }: GetOrganizationDocumentsParams) {
    await this.assertActorMember(organizationId, actorId);

    return this.documentRepository.listByOrganization(organizationId);
  }

  public async listAccessible({ actorId }: ListAccessibleDocumentsParams) {
    return this.documentRepository.listAccessible(actorId);
  }

  public async get({ actorId, documentId }: GetDocumentParams) {
    return this.assertCanAccess(documentId, actorId);
  }

  public async update({ actorId, documentId, title }: UpdateDocumentParams) {
    await this.assertCanAccess(documentId, actorId);

    return this.documentRepository.update(documentId, title);
  }

  public async remove({ actorId, documentId }: RemoveDocumentParams) {
    await this.assertCanAccess(documentId, actorId);

    return this.documentRepository.remove(documentId);
  }

  private async assertActorMember(organizationId: string, actorId: string) {
    const actorMember =
      await this.organizationMemberRepository.findByOrgAndUser(
        organizationId,
        actorId,
      );

    if (!actorMember) throw new NotFoundException(ORGANIZATION_NOT_FOUND_ERROR);

    return actorMember;
  }

  // Доступ к документу = владелец или член организации документа.
  // Отсутствие документа и отсутствие доступа отвечают одинаково (404),
  // чтобы не раскрывать существование чужого документа.
  private async assertCanAccess(documentId: string, actorId: string) {
    const documentRecord = await this.documentRepository.findById(documentId);

    if (!documentRecord) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    if (documentRecord.createdBy === actorId) return documentRecord;

    if (documentRecord.organizationId) {
      const member = await this.organizationMemberRepository.findByOrgAndUser(
        documentRecord.organizationId,
        actorId,
      );

      if (member) return documentRecord;
    }

    throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);
  }
}
