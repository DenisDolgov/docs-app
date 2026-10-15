import { Injectable } from '@nestjs/common';

import { DocumentRepository } from '../document/document.repository';
import { OrganizationMemberRepository } from '../organization/organization-member.repository';
import { CollabAccess, ResolveAccessParams } from './collab.models';

@Injectable()
export class CollabAccessService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
  ) {}

  async resolveAccess({
    documentId,
    userId,
  }: ResolveAccessParams): Promise<CollabAccess | null> {
    const document = await this.documentRepository.findById(documentId);

    if (!document) return null;

    const member = await this.organizationMemberRepository.findByOrgAndUser(
      document.organizationId,
      userId,
    );

    if (!member) return null;

    return {
      organizationId: member.organizationId,
      role: member.role,
    };
  }
}
