import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { UnitOfWork } from '../database/unit-of-work';
import { AccessPolicyService } from '../permission/access-policy.service';
import type {
  CreateNamedVersionParams,
  DocumentVersionView,
  ListVersionsParams,
  RestoreVersionParams,
} from './collab.models';
import { CollabService } from './collab.service';
import { DocumentVersionRepository } from './document-version.repository';
import { DOCUMENT_VERSION_NOT_FOUND_ERROR } from './errors';
import { createVersionRestoreUpdate } from './version-restore';

@Injectable()
export class DocumentVersionService {
  constructor(
    private readonly documentVersionRepository: DocumentVersionRepository,
    private readonly collabService: CollabService,
    private readonly accessPolicy: AccessPolicyService,
    private readonly auditService: AuditService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  // История — это чтение: `viewer` видит список, но байты снапшота не уходят
  // даже ему.
  public async list({
    documentId,
    actorId,
  }: ListVersionsParams): Promise<DocumentVersionView[]> {
    await this.assertAccess(documentId, actorId, 'viewer');

    return this.documentVersionRepository.listByDocument(documentId);
  }

  public async createNamed({
    documentId,
    actorId,
    name,
  }: CreateNamedVersionParams): Promise<DocumentVersionView> {
    await this.assertAccess(documentId, actorId, 'editor');

    return this.collabService.runOnRoom(documentId, async (room) => {
      const { snapshot, updateId } = await room.captureVersion();

      const version = await this.unitOfWork.run(async (tx) => {
        const created = await this.documentVersionRepository.insert(
          {
            documentId,
            kind: 'named',
            name,
            snapshot,
            createdBy: actorId,
            updateId,
          },
          tx,
        );

        await this.auditService.record(
          {
            actorId,
            action: 'document_version.created',
            targetType: 'document',
            targetId: documentId,
            metadata: { versionId: created.id, name },
          },
          tx,
        );

        return created;
      });

      room.markVersionWritten();

      return version;
    });
  }

  // Откат не переписывает историю: он применяет к живой комнате новый апдейт и
  // сохраняет результат как ещё одну именованную версию.
  public async restore({
    documentId,
    versionId,
    actorId,
  }: RestoreVersionParams): Promise<DocumentVersionView> {
    await this.assertAccess(documentId, actorId, 'editor');

    const version = await this.documentVersionRepository.findById(versionId);

    // Версия из чужого документа для этого маршрута не существует.
    if (!version || version.documentId !== documentId) {
      throw new NotFoundException(DOCUMENT_VERSION_NOT_FOUND_ERROR);
    }

    return this.collabService.runOnRoom(documentId, async (room) => {
      const update = createVersionRestoreUpdate(room.doc, version.snapshot);
      room.applyVersionUpdate(update);

      // Новый апдейт должен лечь в журнал до watermark'а новой версии.
      const { snapshot, updateId } = await room.captureVersion();
      const name = `restored from ${version.name ?? version.kind}`;

      const created = await this.unitOfWork.run(async (tx) => {
        const row = await this.documentVersionRepository.insert(
          {
            documentId,
            kind: 'named',
            name,
            snapshot,
            createdBy: actorId,
            updateId,
          },
          tx,
        );

        await this.auditService.record(
          {
            actorId,
            action: 'document_version.restored',
            targetType: 'document',
            targetId: documentId,
            metadata: { versionId, name },
          },
          tx,
        );

        return row;
      });

      room.markVersionWritten();

      return created;
    });
  }

  private assertAccess(
    documentId: string,
    actorId: string,
    required: 'viewer' | 'editor',
  ) {
    return this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required,
    });
  }
}
