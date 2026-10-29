import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, getColumns, or, sql } from 'drizzle-orm';

import { DATABASE, Database } from '../database/database.constants';
import * as schema from '../database/schema';
import { DocumentView } from './document.models';

type DocumentRow = typeof schema.documents.$inferSelect;

const toDocumentView = (row: DocumentRow): DocumentView => ({
  id: row.id,
  organizationId: row.organizationId,
  createdBy: row.createdBy,
  title: row.title,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class DocumentRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async create(
    data: typeof schema.documents.$inferInsert,
  ): Promise<DocumentView> {
    const [document] = await this.db
      .insert(schema.documents)
      .values(data)
      .returning();

    return toDocumentView(document);
  }

  public async listByOrganization(
    organizationId: string,
  ): Promise<DocumentView[]> {
    const documents = await this.db.query.documents.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });

    return documents.map(toDocumentView);
  }

  // Все доступные пользователю документы: личные (владелец), организационные
  // (членство в организации документа) и выданные напрямую share'ом
  public async listAccessible(userId: string): Promise<DocumentView[]> {
    const documents = await this.db
      .selectDistinct(getColumns(schema.documents))
      .from(schema.documents)
      .leftJoin(
        schema.organizationMembers,
        eq(
          schema.documents.organizationId,
          schema.organizationMembers.organizationId,
        ),
      )
      .leftJoin(
        schema.documentShares,
        eq(schema.documents.id, schema.documentShares.documentId),
      )
      .where(
        or(
          eq(schema.documents.createdBy, userId),
          eq(schema.organizationMembers.userId, userId),
          eq(schema.documentShares.userId, userId),
        ),
      )
      .orderBy(desc(schema.documents.updatedAt));

    return documents.map(toDocumentView);
  }

  public async findByIdInOrganization(
    documentId: string,
    organizationId: string,
  ): Promise<DocumentView | null> {
    const document = await this.db.query.documents.findFirst({
      where: { id: documentId, organizationId },
    });

    return document ? toDocumentView(document) : null;
  }

  public async findById(documentId: string): Promise<DocumentView | null> {
    const document = await this.db.query.documents.findFirst({
      where: { id: documentId },
    });

    return document ? toDocumentView(document) : null;
  }

  public async update(
    documentId: string,
    title: string,
  ): Promise<DocumentView | null> {
    const [document] = await this.db
      .update(schema.documents)
      .set({
        title,
        updatedAt: sql`NOW()`,
      })
      .where(eq(schema.documents.id, documentId))
      .returning();

    return document ? toDocumentView(document) : null;
  }

  public async remove(documentId: string): Promise<boolean> {
    const removed = await this.db
      .delete(schema.documents)
      .where(eq(schema.documents.id, documentId))
      .returning({ id: schema.documents.id });

    return removed.length > 0;
  }
}
