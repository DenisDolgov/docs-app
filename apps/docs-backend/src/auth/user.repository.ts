import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE, Database } from '../database/database.constants';
import * as schema from '../database/schema';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async findByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: { email },
    });
  }

  public async create(data: typeof schema.users.$inferInsert) {
    const [user] = await this.db
      .insert(schema.users)
      .values(data)
      .returning({ id: schema.users.id, email: schema.users.email });

    return user;
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
