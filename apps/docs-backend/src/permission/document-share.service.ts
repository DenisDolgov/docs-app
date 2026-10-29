import { Injectable, NotFoundException } from '@nestjs/common';

import { UserRepository } from '../auth/user.repository';
import { normalizeEmail } from '../common/utils/email';
import { USER_NOT_FOUND_ERROR } from '../organization/errors';
import { AccessPolicyService } from './access-policy.service';
import { DocumentShareRepository } from './document-share.repository';
import type {
  DocumentShareListItem,
  DocumentShareView,
  GrantDocumentShareByEmailParams,
  GrantDocumentShareParams,
  ListDocumentSharesParams,
  RevokeDocumentShareParams,
} from './permission.models';

// Выдача и отзыв share. Каждая операция, меняющая состав доступа, обязана
// инвалидировать кэш: иначе отзыв доедет только через TTL.
@Injectable()
export class DocumentShareService {
  constructor(
    private readonly documentShareRepository: DocumentShareRepository,
    private readonly accessPolicy: AccessPolicyService,
    private readonly userRepository: UserRepository,
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

  // HTTP-вход работает по email: uuid получателя клиенту неизвестен.
  public async grantByEmail({
    documentId,
    email,
    role,
    actorId,
  }: GrantDocumentShareByEmailParams) {
    const user = await this.userRepository.findByEmail(normalizeEmail(email));

    if (!user) throw new NotFoundException(USER_NOT_FOUND_ERROR);

    const share = await this.grant({
      documentId,
      userId: user.id,
      role,
      actorId,
    });

    return { ...share, email: user.email };
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

  public async list({
    documentId,
    actorId,
  }: ListDocumentSharesParams): Promise<DocumentShareListItem[]> {
    await this.assertCanManageShares(documentId, actorId);

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
