import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import {
  REFRESH_TOKEN_GC_INTERVAL,
  REFRESH_TOKEN_RETENTION,
} from './auth.constants';
import { RefreshTokenRepository } from './refresh-token.repository';

// Раз в сутки подчищаем историю токенов. `unref()` не держит процесс живым:
// таймер — фоновая уборка, а не работа приложения.
@Injectable()
export class RefreshTokenGcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefreshTokenGcService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      // Уборка не должна ронять процесс: БД может быть недоступна минуту,
      // на следующих сутках попробуем снова.
      this.cleanup().catch((error: unknown) => {
        this.logger.error({ err: error }, 'refresh token GC failed');
      });
    }, REFRESH_TOKEN_GC_INTERVAL);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async cleanup(): Promise<number> {
    const cutoff = new Date(Date.now() - REFRESH_TOKEN_RETENTION);

    return this.refreshTokenRepository.deleteStale(cutoff);
  }
}
