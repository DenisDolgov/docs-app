import { Injectable } from '@nestjs/common';

import { hashToken } from '../auth/token';
import { DocumentAccessRepository } from './document-access.repository';
import type {
  ResolvedPublicLink,
  ResolvePublicLinkParams,
} from './permission.models';
import { PublicLinkRepository } from './public-link.repository';

// Анонимный доступ по ссылке: сессии нет, предъявитель права — сам токен.
// Неизвестная, просроченная, отозванная ссылка и удалённый документ отвечают
// одинаково (`null`), чтобы снаружи их нельзя было различить.
@Injectable()
export class PublicLinkResolver {
  constructor(
    private readonly publicLinkRepository: PublicLinkRepository,
    private readonly documentAccessRepository: DocumentAccessRepository,
  ) {}

  public async resolve({
    token,
  }: ResolvePublicLinkParams): Promise<ResolvedPublicLink | null> {
    const publicLink = await this.publicLinkRepository.findByTokenHash(
      hashToken(token),
    );

    if (!publicLink) return null;
    if (publicLink.revokedAt) return null;
    if (publicLink.expiresAt && publicLink.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const document = await this.documentAccessRepository.findDocumentFacts(
      publicLink.documentId,
    );

    if (!document) return null;

    // Уровень права не возвращаем: в v1.0 ссылка — только чтение, а `role` в
    // строке пока задел на будущее. Потребитель всё равно отдаёт документ без
    // прав записи.
    return { documentId: publicLink.documentId };
  }
}
