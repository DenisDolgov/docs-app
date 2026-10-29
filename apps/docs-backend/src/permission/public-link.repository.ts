import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.constants';
import * as schema from '../database/schema';
import type {
  CreatePublicLinkParams,
  PublicLinkRecord,
  PublicLinkView,
} from './permission.models';

type PublicLinkRow = typeof schema.publicLinks.$inferSelect;

export const toPublicLinkView = (row: PublicLinkRow): PublicLinkView => ({
  id: row.id,
  documentId: row.documentId,
  role: row.role,
  expiresAt: row.expiresAt?.toISOString() ?? null,
  revokedAt: row.revokedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class PublicLinkRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async create({
    documentId,
    actorId,
    expiresAt,
    tokenHash,
  }: CreatePublicLinkParams & { tokenHash: string }): Promise<PublicLinkRow> {
    const [row] = await this.db
      .insert(schema.publicLinks)
      .values({ documentId, createdBy: actorId, expiresAt, tokenHash })
      .returning();

    return row;
  }

  // Поиск ровно по хешу: индекс `unique(token_hash)` и никакого открытого
  // токена в БД.
  public async findByTokenHash(
    tokenHash: string,
  ): Promise<PublicLinkRecord | null> {
    const [row] = await this.db
      .select({
        documentId: schema.publicLinks.documentId,
        expiresAt: schema.publicLinks.expiresAt,
        revokedAt: schema.publicLinks.revokedAt,
      })
      .from(schema.publicLinks)
      .where(eq(schema.publicLinks.tokenHash, tokenHash))
      .limit(1);

    return row ?? null;
  }

  public async listByDocument(documentId: string): Promise<PublicLinkView[]> {
    const rows = await this.db
      .select()
      .from(schema.publicLinks)
      .where(eq(schema.publicLinks.documentId, documentId))
      .orderBy(schema.publicLinks.createdAt);

    return rows.map(toPublicLinkView);
  }

  // Отзыв идемпотентен: уже отозванная ссылка не обновляется повторно.
  public async revoke(documentId: string, linkId: string): Promise<boolean> {
    const rows = await this.db
      .update(schema.publicLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.publicLinks.id, linkId),
          eq(schema.publicLinks.documentId, documentId),
          isNull(schema.publicLinks.revokedAt),
        ),
      )
      .returning({ id: schema.publicLinks.id });

    return rows.length > 0;
  }
}
