import { Injectable, Logger } from '@nestjs/common';

import { decideCheckpoint } from './checkpoint';
import { DocumentVersionRepository } from './document-version.repository';

interface MaybeRecordParams {
  documentId: string;
  snapshot: Uint8Array;
  updateId: number;
  updatesSinceCheckpoint: number;
  now?: Date;
}

// Авто-чекпоинт: решает `decideCheckpoint`, пишет сервис. Ошибка чекпоинта не
// должна ломать сохранение документа — это фоновая оптимизация, а журнал и
// снапшот живут своей жизнью.
@Injectable()
export class VersionCheckpointService {
  private readonly logger = new Logger(VersionCheckpointService.name);

  constructor(
    private readonly documentVersionRepository: DocumentVersionRepository,
  ) {}

  async maybeRecord({
    documentId,
    snapshot,
    updateId,
    updatesSinceCheckpoint,
    now = new Date(),
  }: MaybeRecordParams): Promise<boolean> {
    try {
      const lastCheckpoint =
        await this.documentVersionRepository.findLastCheckpoint(documentId);

      const watermark = decideCheckpoint(
        {
          lastUpdateId: updateId,
          updatesSinceCheckpoint,
          lastCheckpointAt: lastCheckpoint?.createdAt ?? null,
        },
        now,
      );

      if (watermark === null) return false;

      await this.documentVersionRepository.insert({
        documentId,
        kind: 'checkpoint',
        name: null,
        snapshot,
        createdBy: null,
        updateId: watermark,
      });

      return true;
    } catch (error) {
      this.logger.error(
        { documentId, err: error },
        'failed to write collab checkpoint',
      );

      return false;
    }
  }
}
