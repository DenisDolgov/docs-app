import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, Database } from '../database/database.constants';
import * as schema from '../database/schema';

@Injectable()
export class UserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findByEmail(email: string) {
    const result = await this.db.query.users.findFirst({
      where: { email },
    });

    return result || null;
  }

  async create(data: typeof schema.users.$inferInsert) {
    const [user] = await this.db
      .insert(schema.users)
      .values(data)
      .returning({ id: schema.users.id, email: schema.users.email });

    return user;
  }
}
