import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DbExecutor,
} from '../database/database.constants';
import type { RefreshTokenRevokeReason } from '../database/schema';
import * as schema from '../database/schema';
import type { RefreshTokenRecord, SessionView } from './auth.models';

type SessionRow = Omit<SessionView, 'current'>;

@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // Наружу из репозитория уходит типизированная запись без `token_hash`:
  // хеш — внутренность хранилища, сервис и так знает хеш предъявленного
  // токена.
  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const tokenRecord = await this.db.query.refreshTokens.findFirst({
      columns: {
        userId: true,
        sessionId: true,
        userAgent: true,
        ip: true,
        expiresAt: true,
        revokedAt: true,
        revokedReason: true,
      },
      where: { tokenHash },
    });

    return tokenRecord ?? null;
  }

  // CAS: строку обновит только тот, кто застал токен живым. Ноль строк —
  // гонку проиграли (или токен неизвестен), и второй раз его не погасить.
  async revokeByHash(
    tokenHash: string,
    reason: RefreshTokenRevokeReason,
    db: DbExecutor = this.db,
  ) {
    const [tokenRecord] = await db
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
      .returning({ id: schema.refreshTokens.id });

    return tokenRecord ?? null;
  }

  // Только ещё живые токены сессии: при grace-ротации отзываем преемника, а не
  // переписываем причину у уже отозванных записей.
  async revokeActiveBySessionId(
    sessionId: string,
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
          eq(schema.refreshTokens.sessionId, sessionId),
          isNull(schema.refreshTokens.revokedAt),
        ),
      );
  }

  // Отзыв устройства. `user_id` в условии обязателен: id сессии приходит от
  // клиента, и без владельца чужой запрос погасил бы чужую сессию.
  async revokeActiveForUser(
    userId: string,
    sessionId: string,
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
          eq(schema.refreshTokens.sessionId, sessionId),
          isNull(schema.refreshTokens.revokedAt),
        ),
      );
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

  async create(
    data: typeof schema.refreshTokens.$inferInsert,
    db: DbExecutor = this.db,
  ) {
    await db.insert(schema.refreshTokens).values(data);
  }

  // Одна строка на сессию, даже если токен уже ротировался: `created_at` —
  // от первой строки цепочки, метаданные — тоже от неё, `last_used_at` — от
  // последней. Живость сессии решает `having`: живой токен должен быть.
  async listActiveSessions(userId: string): Promise<SessionRow[]> {
    const result = await this.db.execute<SessionRow>(sql`
      select
        t.session_id as "id",
        (array_agg(t.user_agent order by t.created_at asc))[1] as "userAgent",
        (array_agg(t.ip order by t.created_at asc))[1] as "ip",
        min(t.created_at) as "createdAt",
        max(t.last_used_at) as "lastUsedAt"
      from auth.refresh_tokens t
      where t.user_id = ${userId}
      group by t.session_id
      having bool_or(t.revoked_at is null and t.expires_at > now())
      order by max(t.last_used_at) desc
    `);

    return result.rows;
  }

  // GC: истёкшие и отозванные строки старше срока хранения больше не нужны
  // ни списку устройств (там только живые сессии), ни grace-детекции
  async deleteStale(cutoff: Date, db: DbExecutor = this.db) {
    const deletedByExpiresAt = await db
      .delete(schema.refreshTokens)
      .where(lt(schema.refreshTokens.expiresAt, cutoff))
      .returning({ id: schema.refreshTokens.id });
    const deletedByRevokedAt = await db
      .delete(schema.refreshTokens)
      .where(lt(schema.refreshTokens.revokedAt, cutoff))
      .returning({ id: schema.refreshTokens.id });

    return deletedByExpiresAt.length + deletedByRevokedAt.length;
  }
}
