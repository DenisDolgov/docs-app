import { Injectable, NotFoundException } from '@nestjs/common';

import { OrganizationService } from '../organization/organization.service';
import { AccessPolicyService } from '../permission/access-policy.service';
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
    private readonly organizationService: OrganizationService,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  public async createInOrganization({
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
    await this.organizationService.requireMember(organizationId, actorId);

    return this.documentRepository.listByOrganization(organizationId);
  }

  public async listAccessible({ actorId }: ListAccessibleDocumentsParams) {
    return this.documentRepository.listAccessible(actorId);
  }

  public async get({ actorId, documentId }: GetDocumentParams) {
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'viewer',
    });

    const document = await this.documentRepository.findById(documentId);

    if (!document) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    return document;
  }

  public async update({ actorId, documentId, title }: UpdateDocumentParams) {
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'editor',
    });

    const document = await this.documentRepository.update(documentId, title);

    if (!document) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    return document;
  }

  public async remove({ actorId, documentId }: RemoveDocumentParams) {
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'editor',
    });

    const removed = await this.documentRepository.remove(documentId);

    if (!removed) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    // Документа больше нет: снимаем с кэша и его права, чтобы записи не жили
    // до TTL.
    await this.accessPolicy.invalidateDocument(documentId);
  }
}
