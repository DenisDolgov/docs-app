import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

import {
  DATABASE,
  Database,
  type DbExecutor,
} from '../database/database.constants';
import * as schema from '../database/schema';
import type { OrganizationInviteView } from './organization.models';

type InviteRow = typeof schema.organizationInvites.$inferSelect;

const toInviteView = (row: InviteRow): OrganizationInviteView => ({
  id: row.id,
  organizationId: row.organizationId,
  email: row.email,
  role: row.role,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  acceptedAt: row.acceptedAt?.toISOString() ?? null,
});

@Injectable()
export class OrganizationInviteRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async create(
    data: typeof schema.organizationInvites.$inferInsert,
    db: DbExecutor = this.db,
  ): Promise<OrganizationInviteView> {
    const [row] = await db
      .insert(schema.organizationInvites)
      .values(data)
      .returning();

    return toInviteView(row);
  }

  public async findById(
    organizationId: string,
    inviteId: string,
  ): Promise<InviteRow | null> {
    const [row] = await this.db
      .select()
      .from(schema.organizationInvites)
      .where(
        and(
          eq(schema.organizationInvites.id, inviteId),
          eq(schema.organizationInvites.organizationId, organizationId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  public async findByTokenHash(
    tokenHash: string,
    db: DbExecutor = this.db,
  ): Promise<InviteRow | null> {
    const [row] = await db
      .select()
      .from(schema.organizationInvites)
      .where(eq(schema.organizationInvites.tokenHash, tokenHash))
      .limit(1);

    return row ?? null;
  }

  // Погашение одноразовое на уровне запроса: два параллельных принятия не могут
  // оба обновить строку. Просроченное и отозванное сюда не попадают.
  public async consume(
    tokenHash: string,
    db: DbExecutor = this.db,
  ): Promise<InviteRow | null> {
    const [row] = await db
      .update(schema.organizationInvites)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(schema.organizationInvites.tokenHash, tokenHash),
          isNull(schema.organizationInvites.acceptedAt),
          isNull(schema.organizationInvites.revokedAt),
          gt(schema.organizationInvites.expiresAt, new Date()),
        ),
      )
      .returning();

    return row ?? null;
  }

  public async revokeLiveByOrgAndEmail(
    organizationId: string,
    email: string,
    db: DbExecutor = this.db,
  ): Promise<void> {
    await db
      .update(schema.organizationInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.organizationInvites.organizationId, organizationId),
          eq(schema.organizationInvites.email, email),
          isNull(schema.organizationInvites.acceptedAt),
          isNull(schema.organizationInvites.revokedAt),
        ),
      );
  }

  public async revoke(
    organizationId: string,
    inviteId: string,
    db: DbExecutor = this.db,
  ): Promise<boolean> {
    const rows = await db
      .update(schema.organizationInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.organizationInvites.id, inviteId),
          eq(schema.organizationInvites.organizationId, organizationId),
          isNull(schema.organizationInvites.acceptedAt),
          isNull(schema.organizationInvites.revokedAt),
        ),
      )
      .returning({ id: schema.organizationInvites.id });

    return rows.length > 0;
  }

  // В интерфейсе нужны только живые приглашения: отозванные и принятые — уже
  // не действия, а истёкшие не сработают. Историю сознательно не показываем:
  // факт принятия виден в списке участников.
  public async listByOrganization(
    organizationId: string,
  ): Promise<OrganizationInviteView[]> {
    const rows = await this.db
      .select()
      .from(schema.organizationInvites)
      .where(
        and(
          eq(schema.organizationInvites.organizationId, organizationId),
          isNull(schema.organizationInvites.acceptedAt),
          isNull(schema.organizationInvites.revokedAt),
          gt(schema.organizationInvites.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.organizationInvites.createdAt));

    return rows.map(toInviteView);
  }
}
