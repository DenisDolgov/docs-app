import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import { DATABASE, Database } from '../database/database.constants';
import * as schema from '../database/schema';

@Injectable()
export class EmailVerificationTokenRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // Одноразовость держит сама БД: обновляется только ещё живой токен, поэтому
  // две параллельные проверки не могут обе получить строку. Ноль строк — токен
  // неизвестен, истёк или уже использован; сервису не нужно их различать.
  async consume(tokenHash: string) {
    const [tokenRecord] = await this.db
      .update(schema.emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.emailVerificationTokens.tokenHash, tokenHash),
          isNull(schema.emailVerificationTokens.usedAt),
          gt(schema.emailVerificationTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: schema.emailVerificationTokens.userId });

    return tokenRecord ?? null;
  }

  // Погасить активный токен и выпустить новый — одной транзакцией под
  // advisory-lock по пользователю. Без лока два параллельных resend могли бы
  // оба не увидеть токен, вставленный соседом, и оставить два живых токена.
  async replaceForUser(
    userId: string,
    data: Omit<typeof schema.emailVerificationTokens.$inferInsert, 'userId'>,
  ) {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
      );

      await tx
        .update(schema.emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(schema.emailVerificationTokens.userId, userId),
            isNull(schema.emailVerificationTokens.usedAt),
          ),
        );

      await tx
        .insert(schema.emailVerificationTokens)
        .values({ ...data, userId });
    });
  }
}
