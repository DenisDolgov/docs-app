import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.constants';
import * as schema from '../database/schema';
import type { DocumentAccessFacts } from './permission.models';

// Read-модель политики: только те колонки документа, которые участвуют в
// вычислении права. Отдельно от `DocumentRepository`, чтобы модуль прав не
// зависел от модуля документов (иначе получился бы цикл модулей).
@Injectable()
export class DocumentAccessRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async findDocumentFacts(
    documentId: string,
  ): Promise<DocumentAccessFacts | null> {
    const [facts] = await this.db
      .select({
        organizationId: schema.documents.organizationId,
        createdBy: schema.documents.createdBy,
      })
      .from(schema.documents)
      .where(eq(schema.documents.id, documentId))
      .limit(1);

    return facts ?? null;
  }
}
