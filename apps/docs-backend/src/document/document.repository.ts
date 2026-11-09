import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, getColumns, or, sql } from 'drizzle-orm';

import {
  DATABASE,
  Database,
  type DbExecutor,
} from '../database/database.constants';
import * as schema from '../database/schema';
import type { DocumentChanges, DocumentView } from './document.models';

type DocumentRow = typeof schema.documents.$inferSelect;

const toDocumentView = (row: DocumentRow): DocumentView => ({
  id: row.id,
  organizationId: row.organizationId,
  folderId: row.folderId,
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
    db: DbExecutor = this.db,
  ): Promise<DocumentView> {
    const [document] = await db
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
  // (членство в организации документа), выданные напрямую share'ом и
  // унаследованные от папки в цепочке предков.
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
          // Share на папку или её предка открывает документ из поддерева.
          sql`exists (
            with recursive chain as (
              select id, parent_id
              from document.folders
              where id = ${schema.documents.folderId}
              union all
              select f.id, f.parent_id
              from document.folders f
              join chain c on f.id = c.parent_id
            )
            select 1
            from chain c
            join permission.folder_shares fs on fs.folder_id = c.id
            where fs.user_id = ${userId}
          )`,
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
    changes: DocumentChanges,
    db: DbExecutor = this.db,
  ): Promise<DocumentView | null> {
    const set = {
      ...(changes.title === undefined ? {} : { title: changes.title }),
      ...(changes.folderId === undefined ? {} : { folderId: changes.folderId }),
      updatedAt: sql`NOW()`,
    };

    const [document] = await db
      .update(schema.documents)
      .set(set)
      .where(eq(schema.documents.id, documentId))
      .returning();

    return document ? toDocumentView(document) : null;
  }

  public async remove(
    documentId: string,
    db: DbExecutor = this.db,
  ): Promise<boolean> {
    const removed = await db
      .delete(schema.documents)
      .where(eq(schema.documents.id, documentId))
      .returning({ id: schema.documents.id });

    return removed.length > 0;
  }
}
