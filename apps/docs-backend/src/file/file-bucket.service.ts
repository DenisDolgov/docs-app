import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

import { StorageService } from '../storage/storage.service';
import { FILE_BUCKET } from './file.constants';

// Бакет создаётся при старте: приложение не должно писать в несуществующий
// бакет и надеяться на ручную настройку. Публичной политики нет — любой доступ
// только по подписи.
@Injectable()
export class FileBucketService implements OnModuleInit {
  constructor(
    private readonly storage: StorageService,
    @Inject(FILE_BUCKET) private readonly bucket: string,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.storage.ensureBucket(this.bucket);
  }
}
