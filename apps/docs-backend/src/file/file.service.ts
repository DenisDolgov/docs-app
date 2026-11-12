import { randomUUID } from 'node:crypto';
import { NotFound } from '@aws-sdk/client-s3';
import type {
  DownloadUrlResponseDto,
  UploadUrlResponseDto,
} from '@docs-app/contracts/file';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { UnitOfWork } from '../database/unit-of-work';
import type { DocumentView } from '../document/document.models';
import { DocumentRepository } from '../document/document.repository';
import { DOCUMENT_NOT_FOUND_ERROR } from '../document/errors';
import { AccessPolicyService } from '../permission/access-policy.service';
import { hasAccess } from '../permission/permission.constants';
import type { EffectiveAccessLevel } from '../permission/permission.models';
import { SIGNED_URL_TTL_SECONDS } from '../storage/storage.constants';
import { StorageService } from '../storage/storage.service';
import { FILE_NOT_FOUND_ERROR, FILE_REMOVE_STORAGE_ERROR } from './errors';
import { FILE_BUCKET, FILE_KEY_PREFIX } from './file.constants';
import type {
  CompleteUploadParams,
  FileView,
  GetFileParams,
  ListFilesParams,
  RemoveFileParams,
  RequestUploadParams,
  StoredObjectFacts,
} from './file.models';
import { FileRepository } from './file.repository';
import { resolveFileAccess } from './file-access';
import { planUpload, verifyStoredObject } from './upload-policy';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly accessPolicy: AccessPolicyService,
    private readonly storage: StorageService,
    private readonly auditService: AuditService,
    private readonly unitOfWork: UnitOfWork,
    @Inject(FILE_BUCKET) private readonly bucket: string,
  ) {}

  // Первая фаза: сервер решает, что разрешает положить в бакет. В БД попадает
  // заявка (`pending`), а не готовый файл.
  public async requestUpload({
    actorId,
    filename,
    mime,
    size,
    documentId,
  }: RequestUploadParams): Promise<UploadUrlResponseDto> {
    const document = documentId
      ? await this.requireUploadDocument(documentId, actorId)
      : null;

    const planned = planUpload({ filename, mime, size });
    const key = `${FILE_KEY_PREFIX}/${randomUUID()}`;

    const file = await this.fileRepository.createPending({
      ownerId: actorId,
      organizationId: document?.organizationId ?? null,
      documentId: documentId ?? null,
      key,
      ...planned,
    });

    const url = await this.storage.presignUpload(
      this.bucket,
      file.key,
      planned.mime,
    );

    // Подпись покрывает ContentType: клиент обязан отправить ровно этот
    // заголовок, иначе хранилище отклонит PUT.
    return {
      fileId: file.id,
      url,
      method: 'PUT',
      headers: { 'content-type': planned.mime },
    };
  }

  // Вторая фаза: проверяем факты объекта и только тогда открываем файл.
  public async complete({
    fileId,
    actorId,
  }: CompleteUploadParams): Promise<FileView> {
    const file = await this.requireFile(fileId, actorId, 'editor');

    // Повторный `complete` не должен ломать уже готовый файл.
    if (file.status === 'ready') return file;

    const facts = await this.readObjectFacts(file.key);
    const verified = verifyStoredObject(
      { name: file.name, mime: file.mime, size: file.size },
      facts,
    );

    const updated = await this.fileRepository.markReady(file.id, verified);

    if (!updated) throw new NotFoundException(FILE_NOT_FOUND_ERROR);

    return updated;
  }

  public async getDownloadUrl({
    fileId,
    actorId,
  }: GetFileParams): Promise<DownloadUrlResponseDto> {
    const file = await this.requireFile(fileId, actorId, 'viewer');
    const url = await this.storage.presignDownload(this.bucket, file.key);

    return {
      url,
      expiresAt: new Date(
        Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }

  // Стабильный адрес для `src` в контенте документа: каждый запрос получает
  // свежую подпись и уходит редиректом. Сама подпись в документ не попадает.
  public async getContentUrl({
    fileId,
    actorId,
  }: GetFileParams): Promise<string> {
    return (await this.getDownloadUrl({ fileId, actorId })).url;
  }

  public async list({
    documentId,
    actorId,
  }: ListFilesParams): Promise<FileView[]> {
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'viewer',
    });

    return this.fileRepository.listReadyByDocument(documentId);
  }

  public async remove({ fileId, actorId }: RemoveFileParams): Promise<void> {
    const file = await this.requireFile(fileId, actorId, 'editor');

    const removed = await this.unitOfWork.run(async (tx) => {
      const deleted = await this.fileRepository.remove(fileId, tx);

      if (!deleted) return false;

      await this.auditService.record(
        {
          actorId,
          action: 'file.removed',
          targetType: 'file',
          targetId: fileId,
          metadata: { documentId: file.documentId },
        },
        tx,
      );

      return true;
    });

    if (!removed) throw new NotFoundException(FILE_NOT_FOUND_ERROR);

    // Строка уже удалена: осиротевший объект хуже потерянной транзакции, но
    // ронять запрос из-за S3 нельзя — сбой только логируем.
    try {
      await this.storage.remove(this.bucket, file.key);
    } catch (error: unknown) {
      this.logger.error(
        { err: error, key: file.key },
        FILE_REMOVE_STORAGE_ERROR,
      );
    }
  }

  private async requireUploadDocument(
    documentId: string,
    actorId: string,
  ): Promise<DocumentView> {
    // Документ, которого нет, отвечает 404; недостаточный уровень — 403.
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'editor',
    });

    const document = await this.documentRepository.findById(documentId);

    if (!document) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    return document;
  }

  // Файл, которого нет, и файл без права отвечают одинаково — 404.
  private async requireFile(
    fileId: string,
    actorId: string,
    required: EffectiveAccessLevel,
  ): Promise<FileView> {
    const file = await this.fileRepository.findById(fileId);

    if (!file) throw new NotFoundException(FILE_NOT_FOUND_ERROR);

    const documentAccess = file.documentId
      ? await this.accessPolicy.getDocumentAccess({
          documentId: file.documentId,
          principal: { userId: actorId },
        })
      : null;

    const level = resolveFileAccess(
      {
        ownerId: file.ownerId,
        documentId: file.documentId,
        documentAccess,
      },
      actorId,
    );

    if (!hasAccess(level, required)) {
      throw new NotFoundException(FILE_NOT_FOUND_ERROR);
    }

    return file;
  }

  private async readObjectFacts(key: string): Promise<StoredObjectFacts> {
    try {
      const head = await this.storage.head(this.bucket, key);

      return { size: head.ContentLength, mime: head.ContentType };
    } catch (error: unknown) {
      if (error instanceof NotFound) {
        return { size: undefined, mime: undefined };
      }

      throw error;
    }
  }
}
