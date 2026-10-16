import { Injectable } from '@nestjs/common';

import { DocumentRepository } from '../document/document.repository';
import { OrganizationMemberRepository } from '../organization/organization-member.repository';
import { ResolveAccessParams } from './collab.models';

@Injectable()
export class CollabAccessService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
  ) {}

  // Доступ к комнате = владелец или член организации документа.
  // Нет документа и нет доступа отвечают одинаково — чтобы не раскрывать
  // существование чужого документа.
  async resolveAccess({
    documentId,
    userId,
  }: ResolveAccessParams): Promise<boolean> {
    const document = await this.documentRepository.findById(documentId);

    if (!document) return false;

    if (document.createdBy === userId) return true;

    if (!document.organizationId) return false;

    const member = await this.organizationMemberRepository.findByOrgAndUser(
      document.organizationId,
      userId,
    );

    return member !== null;
  }
}
