import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DbExecutor,
} from '../database/database.constants';
import type { RefreshTokenRevokeReason } from '../database/schema';
import * as schema from '../database/schema';

@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findByHash(tokenHash: string) {
    const result = await this.db.query.refreshTokens.findFirst({
      where: { tokenHash },
    });

    return result || null;
  }

  async revokeByHash(tokenHash: string, reason: RefreshTokenRevokeReason) {
    const [tokenRecord] = await this.db
      .update(schema.refreshTokens)
      .set({
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(
        and(
          eq(schema.refreshTokens.tokenHash, tokenHash),
          isNull(schema.refreshTokens.revokedAt),
        ),
      )
      .returning();

    return tokenRecord;
  }

  // Только ещё живые токены сессии: при grace-ротации отзываем преемника, а не
  // переписываем причину у уже отозванных записей.
  async revokeActiveBySessionId(
    sessionId: string,
    reason: RefreshTokenRevokeReason,
  ) {
    await this.db
      .update(schema.refreshTokens)
      .set({
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(
        and(
          eq(schema.refreshTokens.sessionId, sessionId),
          isNull(schema.refreshTokens.revokedAt),
        ),
      );
  }

  async revokeBySessionId(sessionId: string, reason: RefreshTokenRevokeReason) {
    await this.db
      .update(schema.refreshTokens)
      .set({
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(eq(schema.refreshTokens.sessionId, sessionId));
  }

  async revokeAllByUser(
    userId: string,
    reason: RefreshTokenRevokeReason,
    db: DbExecutor = this.db,
  ) {
    await db
      .update(schema.refreshTokens)
      .set({
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(
        and(
          eq(schema.refreshTokens.userId, userId),
          isNull(schema.refreshTokens.revokedAt),
        ),
      );
  }

  async create(data: typeof schema.refreshTokens.$inferInsert) {
    await this.db
      .insert(schema.refreshTokens)
      .values(data)
      .returning({ refreshToken: schema.refreshTokens.tokenHash });
  }
}
