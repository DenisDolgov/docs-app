import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { UnitOfWork } from '../database/unit-of-work';
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
    private readonly auditService: AuditService,
    private readonly unitOfWork: UnitOfWork,
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

    // Удаление стирает и сам объект, и весь его состав доступа. После коммита
    // `audit.events` — единственный след, поэтому событие пишется в той же
    // транзакции: без записи документ не удаляется.
    const removed = await this.unitOfWork.run(async (tx) => {
      const deleted = await this.documentRepository.remove(documentId, tx);

      if (!deleted) return false;

      await this.auditService.record(
        {
          actorId,
          action: 'document.removed',
          targetType: 'document',
          targetId: documentId,
        },
        tx,
      );

      return true;
    });

    if (!removed) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    await this.accessPolicy.invalidateDocument(documentId);
  }
}
