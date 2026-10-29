import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  DOCUMENT_FORBIDDEN_ERROR,
  DOCUMENT_NOT_FOUND_ERROR,
} from '../document/errors';
import { AccessResolver } from './access-resolver';
import { DocumentAccessCache } from './document-access-cache';
import { hasAccess } from './permission.constants';
import type {
  AssertDocumentAccessParams,
  CacheDocumentAccessParams,
  DocumentAccessParams,
  EffectiveAccessLevel,
} from './permission.models';

@Injectable()
export class AccessPolicyService {
  private readonly logger = new Logger(AccessPolicyService.name);

  constructor(
    private readonly accessResolver: AccessResolver,
    private readonly documentAccessCache: DocumentAccessCache,
  ) {}

  // Cache-aside: кэш — ускоритель, источник истины — `AccessResolver`
  public async getDocumentAccess({
    documentId,
    principal,
  }: DocumentAccessParams): Promise<EffectiveAccessLevel | null> {
    const cached = await this.readCache({ documentId, principal });

    if (cached !== undefined) return cached;

    const level = await this.accessResolver.resolve({ documentId, principal });

    await this.writeCache({ documentId, principal, level });

    return level;
  }

  // Документ, которого для тебя нет, отвечает 404: иначе его можно найти
  // перебором. Недостаточный уровень — 403: документ уже виден, скрывать нечего,
  // и клиент может показать «попросить доступ».
  public async assertDocumentAccess({
    documentId,
    principal,
    required,
  }: AssertDocumentAccessParams): Promise<EffectiveAccessLevel> {
    const level = await this.getDocumentAccess({ documentId, principal });

    if (level === null) {
      throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);
    }

    if (!hasAccess(level, required)) {
      throw new ForbiddenException(DOCUMENT_FORBIDDEN_ERROR);
    }

    return level;
  }

  public async invalidateDocument(documentId: string): Promise<void> {
    try {
      await this.documentAccessCache.invalidate(documentId);
    } catch (error) {
      // Версия не выросла — старые записи доживут до TTL. Это не повод
      // отклонять операцию: запись в БД уже состоялась.
      this.logger.warn(`Не удалось инвалидировать кэш документа ${documentId}`);
      this.logger.warn(error);
    }
  }

  private async readCache({
    documentId,
    principal,
  }: DocumentAccessParams): Promise<EffectiveAccessLevel | null | undefined> {
    try {
      return await this.documentAccessCache.get({
        documentId,
        principalId: principal.userId,
      });
    } catch (error) {
      this.logger.warn(
        `Кэш прав недоступен, считаем право из БД: ${documentId}`,
      );
      this.logger.warn(error);
      return undefined;
    }
  }

  private async writeCache(params: CacheDocumentAccessParams): Promise<void> {
    try {
      await this.documentAccessCache.set({
        documentId: params.documentId,
        principal: params.principal,
        level: params.level,
      });
    } catch (error) {
      this.logger.warn(`Не удалось закэшировать право: ${params.documentId}`);
      this.logger.warn(error);
    }
  }
}
