import { Injectable } from '@nestjs/common';

import { AccessPolicyService } from './access-policy.service';
import { DocumentShareRepository } from './document-share.repository';
import type {
  DocumentShareView,
  GrantDocumentShareParams,
  RevokeDocumentShareParams,
} from './permission.models';

// Выдача и отзыв share. HTTP-слой появится в M1.5; здесь — доменные операции,
// которые обязаны инвалидировать кэш, иначе отзыв доедет только через TTL.
@Injectable()
export class DocumentShareService {
  constructor(
    private readonly documentShareRepository: DocumentShareRepository,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  // Выдавать share может только владелец документа: `editor` управляет
  // содержимым, но не составом участников.
  public async grant({
    documentId,
    userId,
    role,
    actorId,
  }: GrantDocumentShareParams): Promise<DocumentShareView> {
    await this.assertCanManageShares(documentId, actorId);

    const share = await this.documentShareRepository.upsert({
      documentId,
      userId,
      role,
      actorId,
    });

    await this.accessPolicy.invalidateDocument(documentId);

    return share;
  }

  public async revoke({
    documentId,
    userId,
    actorId,
  }: RevokeDocumentShareParams): Promise<boolean> {
    await this.assertCanManageShares(documentId, actorId);

    const removed = await this.documentShareRepository.deleteByDocumentAndUser(
      documentId,
      userId,
    );

    if (removed) await this.accessPolicy.invalidateDocument(documentId);

    return removed;
  }

  public list(documentId: string): Promise<DocumentShareView[]> {
    return this.documentShareRepository.listByDocument(documentId);
  }

  private assertCanManageShares(documentId: string, actorId: string) {
    return this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'owner',
    });
  }
}
