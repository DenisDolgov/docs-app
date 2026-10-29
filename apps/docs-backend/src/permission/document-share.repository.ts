import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.constants';
import * as schema from '../database/schema';
import type {
  DocumentShareView,
  GrantDocumentShareParams,
} from './permission.models';

type DocumentShareRow = typeof schema.documentShares.$inferSelect;

const toDocumentShareView = (row: DocumentShareRow): DocumentShareView => ({
  id: row.id,
  documentId: row.documentId,
  userId: row.userId,
  role: row.role,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class DocumentShareRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async upsert({
    documentId,
    userId,
    role,
    actorId,
  }: GrantDocumentShareParams): Promise<DocumentShareView> {
    const [row] = await this.db
      .insert(schema.documentShares)
      .values({ documentId, userId, role, createdBy: actorId })
      .onConflictDoUpdate({
        target: [
          schema.documentShares.documentId,
          schema.documentShares.userId,
        ],
        set: { role },
      })
      .returning();

    return toDocumentShareView(row);
  }

  public async findByDocumentAndUser(
    documentId: string,
    userId: string,
  ): Promise<DocumentShareView | null> {
    const row = await this.db.query.documentShares.findFirst({
      where: { documentId, userId },
    });

    return row ? toDocumentShareView(row) : null;
  }

  public async listByDocument(
    documentId: string,
  ): Promise<DocumentShareView[]> {
    const rows = await this.db.query.documentShares.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(toDocumentShareView);
  }

  public async deleteByDocumentAndUser(
    documentId: string,
    userId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .delete(schema.documentShares)
      .where(
        and(
          eq(schema.documentShares.documentId, documentId),
          eq(schema.documentShares.userId, userId),
        ),
      )
      .returning({ id: schema.documentShares.id });

    return rows.length > 0;
  }
}
