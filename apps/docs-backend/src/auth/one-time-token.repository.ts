import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type {
  PgColumn,
  PgInsertValue,
  PgTable,
  PgUpdateSetSource,
} from 'drizzle-orm/pg-core';

import type { Database, DbExecutor } from '../database/database.constants';

type OneTimeTokenTable = PgTable & {
  id: PgColumn;
  userId: PgColumn;
  tokenHash: PgColumn;
  expiresAt: PgColumn;
  createdAt: PgColumn;
  usedAt: PgColumn;
};

export abstract class OneTimeTokenRepository {
  protected constructor(
    protected readonly db: Database,
    private readonly table: OneTimeTokenTable,
  ) {}

  async findActive(tokenHash: string, db: DbExecutor = this.db) {
    const [tokenRecord] = await db
      .select({ userId: this.table.userId })
      .from(this.table)
      .where(
        and(
          eq(this.table.tokenHash, tokenHash),
          isNull(this.table.usedAt),
          gt(this.table.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return tokenRecord ? { userId: tokenRecord.userId as string } : null;
  }

  // Одноразовость держит сама БД: обновляется только ещё живой токен, поэтому
  // две параллельные проверки не могут обе получить строку. Ноль строк — токен
  // неизвестен, истёк или уже использован; сервису не нужно их различать.
  async consume(tokenHash: string, db: DbExecutor = this.db) {
    const [tokenRecord] = await db
      .update(this.table)
      .set({ usedAt: new Date() } as PgUpdateSetSource<OneTimeTokenTable>)
      .where(
        and(
          eq(this.table.tokenHash, tokenHash),
          isNull(this.table.usedAt),
          gt(this.table.expiresAt, new Date()),
        ),
      )
      .returning({ userId: this.table.userId });

    return tokenRecord ? { userId: tokenRecord.userId as string } : null;
  }

  // Тот же advisory-lock, что и в `replaceForUser`: он сериализует выпуск и
  // погашение токенов одного пользователя.
  async lockUser(userId: string, db: DbExecutor = this.db) {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
    );
  }

  async consumeAllForUser(userId: string, db: DbExecutor = this.db) {
    await db
      .update(this.table)
      .set({ usedAt: new Date() } as PgUpdateSetSource<OneTimeTokenTable>)
      .where(and(eq(this.table.userId, userId), isNull(this.table.usedAt)));
  }

  // Погасить активный токен и выпустить новый — одной транзакцией под
  // advisory-lock по пользователю. Без лока два параллельных запроса могли бы
  // оба не увидеть токен, вставленный соседом, и оставить два живых токена.
  async replaceForUser(
    userId: string,
    data: { tokenHash: string; expiresAt: Date },
    db: DbExecutor = this.db,
  ) {
    await db.transaction(async (tx) => {
      await this.lockUser(userId, tx);
      await this.consumeAllForUser(userId, tx);
      await tx
        .insert(this.table)
        .values({ ...data, userId } as PgInsertValue<OneTimeTokenTable>);
    });
  }
}
