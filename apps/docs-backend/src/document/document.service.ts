import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { UnitOfWork } from '../database/unit-of-work';
import { OrganizationService } from '../organization/organization.service';
import { AccessPolicyService } from '../permission/access-policy.service';
import type { DocumentChanges } from './document.models';
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
import { FolderService } from './folder.service';

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly organizationService: OrganizationService,
    private readonly accessPolicy: AccessPolicyService,
    private readonly auditService: AuditService,
    private readonly unitOfWork: UnitOfWork,
    private readonly folderService: FolderService,
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

  async update({ actorId, documentId, title, folderId }: UpdateDocumentParams) {
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'editor',
    });

    // Перенос — это изменение пути, а значит и эффективного права. Папка
    // обязана быть из той же организации, что и документ.
    if (folderId !== undefined && folderId !== null) {
      const document = await this.documentRepository.findById(documentId);

      if (!document) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

      await this.folderService.assertFolderForDocument(
        folderId,
        document.organizationId,
      );
    }

    const changes: DocumentChanges = {};

    if (title !== undefined) changes.title = title;
    if (folderId !== undefined) changes.folderId = folderId;

    const updated = await this.documentRepository.update(documentId, changes);

    if (!updated) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    await this.accessPolicy.invalidateDocument(documentId);

    // Соседи по новой папке не меняются, но `invalidateFolder` покрывает и
    // случай, когда документ переехал в поддерево с иным унаследованным правом.
    if (folderId !== undefined && folderId !== null) {
      await this.accessPolicy.invalidateFolder(folderId);
    }

    return updated;
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
