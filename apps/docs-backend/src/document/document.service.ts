import { Injectable, NotFoundException } from '@nestjs/common';

import { OrganizationService } from '../organization/organization.service';
import { AccessPolicyService } from '../permission/access-policy.service';
import {
  CreateDocumentParams,
  CreatePersonalDocumentParams,
  GetDocumentParams,
  GetOrganizationDocumentsParams,
  GetPublicDocumentParams,
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
    private readonly organizationService: OrganizationService,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  async createInOrganization({
    organizationId,
    actorId,
    title,
  }: CreateDocumentParams) {
    await this.organizationService.requireMember(organizationId, actorId);

    return await this.documentRepository.create({
      organizationId,
      createdBy: actorId,
      title,
    });
  }

  async createPersonal({ actorId, title }: CreatePersonalDocumentParams) {
    return await this.documentRepository.create({
      createdBy: actorId,
      title,
    });
  }

  async listInOrganization({
    organizationId,
    actorId,
  }: GetOrganizationDocumentsParams) {
    await this.organizationService.requireMember(organizationId, actorId);

    return this.documentRepository.listByOrganization(organizationId);
  }

  async listAccessible({ actorId }: ListAccessibleDocumentsParams) {
    return this.documentRepository.listAccessible(actorId);
  }

  async get({ actorId, documentId }: GetDocumentParams) {
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'viewer',
    });

    const document = await this.documentRepository.findById(documentId);

    if (!document) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    return document;
  }

  async getPublic({ documentId }: GetPublicDocumentParams) {
    const document = await this.documentRepository.findById(documentId);

    if (!document) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    return document;
  }

  async update({ actorId, documentId, title }: UpdateDocumentParams) {
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'editor',
    });

    const document = await this.documentRepository.update(documentId, title);

    if (!document) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    return document;
  }

  async remove({ actorId, documentId }: RemoveDocumentParams) {
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'editor',
    });

    const removed = await this.documentRepository.remove(documentId);

    if (!removed) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    await this.accessPolicy.invalidateDocument(documentId);
  }
}
