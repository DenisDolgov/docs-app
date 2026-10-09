import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE, Database } from '../database/database.constants';
import * as schema from '../database/schema';

@Injectable()
export class OrganizationRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async create(data: typeof schema.organizations.$inferInsert) {
    const [organization] = await this.db
      .insert(schema.organizations)
      .values(data)
      .returning({
        id: schema.organizations.id,
        name: schema.organizations.name,
      });

    return organization;
  }

  public async listForUser(userId: string) {
    return this.db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        role: schema.organizationMembers.role,
      })
      .from(schema.organizationMembers)
      .innerJoin(
        schema.organizations,
        eq(schema.organizationMembers.organizationId, schema.organizations.id),
      )
      .where(eq(schema.organizationMembers.userId, userId));
  }
}
