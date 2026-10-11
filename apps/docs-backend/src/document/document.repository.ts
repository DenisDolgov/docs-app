import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { DATABASE, Database } from '../database/database.constants';
import * as schema from '../database/schema';
import { UpdateDocumentParams } from './document.models';

@Injectable()
export class DocumentRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // todo или лучше явно типизировать interface data??
  // todo стоит ли типизировать возвращаемое значение явно DocumentView?
  public async create(data: typeof schema.documents.$inferInsert) {
    const [document] = await this.db
      .insert(schema.documents)
      .values(data)
      .returning({
        id: schema.documents.id,
        organizationId: schema.documents.organizationId,
        createdBy: schema.documents.createdBy,
        title: schema.documents.title,
        createdAt: schema.documents.createdAt,
        updatedAt: schema.documents.updatedAt,
      });

    return document;
  }

  public async listByOrganization(organizationId: string) {
    return this.db.query.documents.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  public async findByIdInOrganization(
    documentId: string,
    organizationId: string,
  ) {
    return (
      (await this.db.query.documents.findFirst({
        where: { id: documentId, organizationId },
      })) ?? null
    );
  }

  public async update(documentId: string, title: string) {
    const [document] = await this.db
      .update(schema.documents)
      .set({
        title,
        updatedAt: sql`NOW()`,
      })
      .where(eq(schema.documents.id, documentId))
      .returning({
        id: schema.documents.id,
        organizationId: schema.documents.organizationId,
        createdBy: schema.documents.createdBy,
        title: schema.documents.title,
        createdAt: schema.documents.createdAt,
        updatedAt: schema.documents.updatedAt,
      });

    return document;
  }

  public async remove(documentId: string) {
    return this.db
      .delete(schema.documents)
      .where(eq(schema.documents.id, documentId));
  }
}
