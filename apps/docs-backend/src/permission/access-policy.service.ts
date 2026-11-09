import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  DOCUMENT_FORBIDDEN_ERROR,
  DOCUMENT_NOT_FOUND_ERROR,
  FOLDER_FORBIDDEN_ERROR,
  FOLDER_NOT_FOUND_ERROR,
} from '../document/errors';
import { OrganizationService } from '../organization/organization.service';
import { AccessResolver } from './access-resolver';
import { DocumentAccessCache } from './document-access-cache';
import { FolderAccessRepository } from './folder-access.repository';
import {
  hasAccess,
  mapOrganizationRole,
  maxAccessLevel,
} from './permission.constants';
import type {
  AssertDocumentAccessParams,
  AssertFolderAccessParams,
  CacheDocumentAccessParams,
  DocumentAccessParams,
  EffectiveAccessLevel,
  FolderAccessParams,
} from './permission.models';

@Injectable()
export class AccessPolicyService {
  private readonly logger = new Logger(AccessPolicyService.name);

  constructor(
    private readonly accessResolver: AccessResolver,
    private readonly documentAccessCache: DocumentAccessCache,
    private readonly folderAccessRepository: FolderAccessRepository,
    private readonly organizationService: OrganizationService,
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

  // Право на папку считается без кэша: операции с деревом редкие, а цена
  // лишнего запроса ниже цены рассинхрона с иерархией.
  public async getFolderAccess({
    folderId,
    principal,
  }: FolderAccessParams): Promise<EffectiveAccessLevel | null> {
    const facts = await this.folderAccessRepository.findFolderFacts(folderId);

    if (!facts) return null;

    if (facts.createdBy === principal.userId) return 'owner';

    const levels: Array<EffectiveAccessLevel | null> = [];

    const organizationRole = await this.organizationService.getMemberRole(
      facts.organizationId,
      principal.userId,
    );

    if (organizationRole) {
      levels.push(mapOrganizationRole(organizationRole));
    }

    levels.push(
      ...(await this.folderAccessRepository.findShareLevelsByFolderChain(
        folderId,
        principal.userId,
      )),
    );

    return maxAccessLevel(levels);
  }

  public async assertFolderAccess({
    folderId,
    principal,
    required,
  }: AssertFolderAccessParams): Promise<EffectiveAccessLevel> {
    const level = await this.getFolderAccess({ folderId, principal });

    if (level === null) {
      throw new NotFoundException(FOLDER_NOT_FOUND_ERROR);
    }

    if (!hasAccess(level, required)) {
      throw new ForbiddenException(FOLDER_FORBIDDEN_ERROR);
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

  // Изменение на папке меняет ответ для всего поддерева, поэтому инвалидация
  // идёт не по одной записи, а по всем документам внутри.
  public async invalidateFolder(folderId: string): Promise<void> {
    const documentsIds =
      await this.folderAccessRepository.findDescendantDocumentIds(folderId);

    for (const documentId of documentsIds) {
      await this.invalidateDocument(documentId);
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
