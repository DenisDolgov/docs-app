import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import { DATABASE, Database } from '../database/database.constants';
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

  async revokeByHash(tokenHash: string) {
    const [tokenRecord] = await this.db
      .update(schema.refreshTokens)
      .set({
        revokedAt: new Date(),
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

  async revokeBySessionId(sessionId: string) {
    await this.db
      .update(schema.refreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(schema.refreshTokens.sessionId, sessionId));
  }

  async revokeAllByUser(userId: string) {
    await this.db
      .update(schema.refreshTokens)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(schema.refreshTokens.userId, userId));
  }

  async create(data: typeof schema.refreshTokens.$inferInsert) {
    await this.db
      .insert(schema.refreshTokens)
      .values(data)
      .returning({ refreshToken: schema.refreshTokens.tokenHash });
  }
}
