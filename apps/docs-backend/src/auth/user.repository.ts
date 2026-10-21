import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DbExecutor,
} from '../database/database.constants';
import * as schema from '../database/schema';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async findByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: { email },
    });
  }

  // Регистрация — одна единица работы: если токен не записался, пользователя
  // быть не должно, иначе повторная регистрация упрётся в 409.
  public async createWithVerificationToken(
    user: typeof schema.users.$inferInsert,
    token: Omit<typeof schema.emailVerificationTokens.$inferInsert, 'userId'>,
  ) {
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.users)
        .values(user)
        .returning({ id: schema.users.id, email: schema.users.email });

      await tx.insert(schema.emailVerificationTokens).values({
        ...token,
        userId: created.id,
      });

      return created;
    });
  }

  async resetPassword(
    id: string,
    passwordHash: string,
    db: DbExecutor = this.db,
  ) {
    const [userRecord] = await db
      .update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, id))
      .returning({ id: schema.users.id });

    // Пользователь мог быть удалён между погашением токена и обновлением
    // сервис обязан превратить это в BadRequestException, а не в 500.
    return userRecord ?? null;
  }

  public async findById(id: string) {
    return this.db.query.users.findFirst({
      where: { id },
    });
  }

  public async findByIds(ids: string[]) {
    if (ids.length === 0) return [];

    return this.db.query.users.findMany({
      where: { id: { in: ids } },
    });
  }

  public async markEmailVerified(id: string) {
    await this.db
      .update(schema.users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(schema.users.id, id));
  }
}
