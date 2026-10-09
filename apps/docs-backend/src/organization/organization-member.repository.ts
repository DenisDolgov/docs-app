import { Inject, Injectable } from '@nestjs/common';

import { DATABASE, Database } from '../database/database.constants';
import * as schema from '../database/schema';

@Injectable()
export class OrganizationMemberRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async create(data: typeof schema.organizationMembers.$inferInsert) {
    const [record] = await this.db
      .insert(schema.organizationMembers)
      .values(data)
      .returning({
        id: schema.organizationMembers.id,
        organizationId: schema.organizationMembers.organizationId,
        userId: schema.organizationMembers.userId,
        role: schema.organizationMembers.role,
      });

    return record;
  }

  public async findByOrgAndUser(organizationId: string, userId: string) {
    const record = await this.db.query.organizationMembers.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    return record ?? null;
  }

  public async listByOrganization(organizationId: string) {
    return this.db.query.organizationMembers.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
