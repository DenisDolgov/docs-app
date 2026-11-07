import { Injectable, Logger } from '@nestjs/common';

import type { DbExecutor } from '../database/database.constants';
import type { AuditEventParams } from './audit.models';
import { AuditRepository } from './audit.repository';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  public async record(params: AuditEventParams, db: DbExecutor): Promise<void> {
    return this.auditRepository.insert(params, db);
  }

  public async recordBestEffort(params: AuditEventParams): Promise<void> {
    try {
      await this.auditRepository.insert(params);
    } catch (err) {
      this.logger.error({ err }, 'cannot insert audit event');
    }
  }
}
