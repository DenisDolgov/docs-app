import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { StorageService } from '../storage/storage.service';
import {
  FILE_BUCKET,
  FILE_GC_INTERVAL,
  FILE_PENDING_RETENTION,
} from './file.constants';
import { FileRepository } from './file.repository';

// Раз в час подчищаем брошенные загрузки. `unref()` не держит процесс живым:
// таймер — фоновая уборка, а не работа приложения.
@Injectable()
export class FileGcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FileGcService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storage: StorageService,
    @Inject(FILE_BUCKET) private readonly bucket: string,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.cleanup().catch((error: unknown) => {
        this.logger.error({ err: error }, 'file GC failed');
      });
    }, FILE_GC_INTERVAL);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // Объект удаляем раньше строки: если хранилище недоступно, строка останется
  // `pending` и попадёт в следующую уборку, а не станет сиротой в бакете.
  async cleanup(): Promise<number> {
    const cutoff = new Date(Date.now() - FILE_PENDING_RETENTION);
    const expired = await this.fileRepository.findExpiredPending(cutoff);
    let removed = 0;

    for (const file of expired) {
      try {
        await this.storage.remove(this.bucket, file.key);
      } catch (error: unknown) {
        this.logger.warn(
          { err: error, key: file.key },
          'cannot remove pending object',
        );
        continue;
      }

      try {
        if (await this.fileRepository.remove(file.id)) removed += 1;
      } catch (error: unknown) {
        this.logger.error(
          { err: error, fileId: file.id },
          'cannot remove pending file row',
        );
      }
    }

    return removed;
  }
}
