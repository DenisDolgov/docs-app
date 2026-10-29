import { Injectable } from '@nestjs/common';

import { OrganizationService } from '../organization/organization.service';
import { DocumentAccessRepository } from './document-access.repository';
import { DocumentShareRepository } from './document-share.repository';
import { hasAccess, mapOrganizationRole } from './permission.constants';
import type {
  EffectiveAccessLevel,
  ResolveAccessParams,
} from './permission.models';

// Чистое вычисление права: без Redis, без HTTP, без знания о документе за
// пределами `DocumentAccessFacts`.
@Injectable()
export class AccessResolver {
  constructor(
    private readonly documentAccessRepository: DocumentAccessRepository,
    private readonly organizationService: OrganizationService,
    private readonly documentShareRepository: DocumentShareRepository,
  ) {}

  public async resolve({
    documentId,
    principal,
  }: ResolveAccessParams): Promise<EffectiveAccessLevel | null> {
    const facts =
      await this.documentAccessRepository.findDocumentFacts(documentId);

    if (!facts) return null;

    if (facts.createdBy === principal.userId) return 'owner';

    const share = await this.documentShareRepository.findByDocumentAndUser(
      documentId,
      principal.userId,
    );
    const levelByShare = share?.role ?? null;

    let levelByOrganization: EffectiveAccessLevel | null = null;

    if (facts.organizationId) {
      const organizationRole = await this.organizationService.getMemberRole(
        facts.organizationId,
        principal.userId,
      );

      levelByOrganization = organizationRole
        ? mapOrganizationRole(organizationRole)
        : null;
    }

    if (levelByOrganization && levelByShare) {
      return hasAccess(levelByOrganization, levelByShare)
        ? levelByOrganization
        : levelByShare;
    }

    return levelByOrganization ?? levelByShare;
  }
}
