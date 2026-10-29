import { Injectable } from '@nestjs/common';

import { generateToken, hashToken } from '../auth/token';
import { ValidationException } from '../common/validation.exception';
import { AccessPolicyService } from './access-policy.service';
import type {
  CreatedPublicLinkView,
  CreatePublicLinkParams,
  ListPublicLinksParams,
  PublicLinkView,
  RevokePublicLinkParams,
} from './permission.models';
import {
  PublicLinkRepository,
  toPublicLinkView,
} from './public-link.repository';

@Injectable()
export class PublicLinkService {
  constructor(
    private readonly publicLinkRepository: PublicLinkRepository,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  public async create({
    documentId,
    actorId,
    expiresAt,
  }: CreatePublicLinkParams): Promise<CreatedPublicLinkView> {
    await this.assertCanManageLinks(documentId, actorId);

    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new ValidationException([
        {
          path: ['expiresAt'],
          message: 'expiresAt must be in the future',
        },
      ]);
    }

    // Plaintext существует только здесь: в БД кладём хеш, в ответ — токен.
    const token = generateToken();
    const row = await this.publicLinkRepository.create({
      documentId,
      actorId,
      expiresAt,
      tokenHash: hashToken(token),
    });

    return { ...toPublicLinkView(row), token };
  }

  public async revoke({
    documentId,
    linkId,
    actorId,
  }: RevokePublicLinkParams): Promise<boolean> {
    await this.assertCanManageLinks(documentId, actorId);

    return this.publicLinkRepository.revoke(documentId, linkId);
  }

  public async list({
    documentId,
    actorId,
  }: ListPublicLinksParams): Promise<PublicLinkView[]> {
    await this.assertCanManageLinks(documentId, actorId);

    return this.publicLinkRepository.listByDocument(documentId);
  }

  // Управление ссылками — то же право, что у share: раздавать доступ может
  // только владелец. `viewer` не должен видеть даже список ссылок.
  private assertCanManageLinks(documentId: string, actorId: string) {
    return this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'owner',
    });
  }
}
