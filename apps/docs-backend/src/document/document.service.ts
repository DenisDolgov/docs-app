import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { ORGANIZATION_NOT_FOUND_ERROR } from '../organization/errors';
import { OrganizationMemberRepository } from '../organization/organization-member.repository';
import { canUpdateDocument } from './document.constants';
import {
  CreateDocumentParams,
  GetDocumentParams,
  GetOrganizationDocumentsParams,
  RemoveDocumentParams,
  UpdateDocumentParams,
} from './document.models';
import { DocumentRepository } from './document.repository';
import { DOCUMENT_NOT_FOUND_ERROR } from './errors';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
  ) {}

  public async create({
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

  public async list({
    organizationId,
    actorId,
  }: GetOrganizationDocumentsParams) {
    await this.assertActorMember(organizationId, actorId);

    return this.documentRepository.listByOrganization(organizationId);
  }

  public async get({ organizationId, actorId, documentId }: GetDocumentParams) {
    await this.assertActorMember(organizationId, actorId);

    const documentRecord = await this.documentRepository.findByIdInOrganization(
      documentId,
      organizationId,
    );

    if (!documentRecord) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    return documentRecord;
  }

  public async update({
    organizationId,
    actorId,
    documentId,
    title,
  }: UpdateDocumentParams) {
    await this.assertActorCanEdit(organizationId, actorId, documentId);

    return this.documentRepository.update(documentId, title);
  }

  public async remove({
    organizationId,
    actorId,
    documentId,
  }: RemoveDocumentParams) {
    await this.assertActorCanEdit(organizationId, actorId, documentId);

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

  private async assertActorCanEdit(
    organizationId: string,
    actorId: string,
    documentId: string,
  ) {
    const memberRecord = await this.assertActorMember(organizationId, actorId);

    const documentRecord = await this.documentRepository.findByIdInOrganization(
      documentId,
      organizationId,
    );

    if (!documentRecord) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    if (
      !canUpdateDocument(memberRecord.role) &&
      documentRecord.createdBy !== actorId
    ) {
      throw new ForbiddenException();
    }
  }
}
