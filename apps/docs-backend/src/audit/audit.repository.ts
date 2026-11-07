import { Inject, Injectable } from '@nestjs/common';

import {
  DATABASE,
  type Database,
  type DbExecutor,
} from '../database/database.constants';
import * as schema from '../database/schema';
import type { AuditEventParams } from './audit.models';

// Только вставка. `update`/`delete` здесь не появятся: журнал, который можно
// переписать, перестаёт быть доказательством.
@Injectable()
export class AuditRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async insert(
    params: AuditEventParams,
    db: DbExecutor = this.db,
  ): Promise<void> {
    await db.insert(schema.auditEvents).values({
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata ?? {},
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    });
  }
}
