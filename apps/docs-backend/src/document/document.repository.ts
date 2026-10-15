import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

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
  ): Promise<DocumentView> {
    const [document] = await this.db
      .update(schema.documents)
      .set({
        title,
        updatedAt: sql`NOW()`,
      })
      .where(eq(schema.documents.id, documentId))
      .returning();

    return toDocumentView(document);
  }

  public async remove(documentId: string) {
    return this.db
      .delete(schema.documents)
      .where(eq(schema.documents.id, documentId));
  }
}
