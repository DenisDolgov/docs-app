import { Inject, Injectable } from '@nestjs/common';

import {
  DATABASE,
  type Database,
  type DbExecutor,
} from '../database/database.constants';
import * as schema from '../database/schema';
import type {
  DocumentVersionView,
  DocumentVersionWithSnapshot,
  RecordVersionParams,
} from './collab.models';

type VersionRow = Omit<typeof schema.documentVersions.$inferSelect, 'snapshot'>;

const toVersionView = (row: VersionRow): DocumentVersionView => ({
  id: row.id,
  documentId: row.documentId,
  kind: row.kind,
  name: row.name,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updateId: row.updateId,
});

// История версий: снаружи — только метаданные, снапшот читается точечно по id.
@Injectable()
export class DocumentVersionRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async listByDocument(
    documentId: string,
  ): Promise<DocumentVersionView[]> {
    const rows = await this.db.query.documentVersions.findMany({
      where: { documentId },
      // Колонки перечисляем явно: `snapshot` в список попасть не должен.
      columns: {
        id: true,
        documentId: true,
        kind: true,
        name: true,
        createdBy: true,
        createdAt: true,
        updateId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(toVersionView);
  }

  public async findById(
    versionId: string,
  ): Promise<DocumentVersionWithSnapshot | null> {
    const row = await this.db.query.documentVersions.findFirst({
      where: { id: versionId },
    });

    if (!row) return null;

    return { ...toVersionView(row), snapshot: row.snapshot };
  }

  // Последний авто-чекпоинт: по его времени считается порог «10 минут».
  public async findLastCheckpoint(documentId: string) {
    const row = await this.db.query.documentVersions.findFirst({
      where: { documentId, kind: 'checkpoint' },
      columns: { createdAt: true, updateId: true },
      orderBy: { createdAt: 'desc' },
    });

    return row ?? null;
  }

  public async insert(
    params: RecordVersionParams,
    db: DbExecutor = this.db,
  ): Promise<DocumentVersionView> {
    const [row] = await db
      .insert(schema.documentVersions)
      .values({
        documentId: params.documentId,
        kind: params.kind,
        name: params.name,
        snapshot: params.snapshot,
        createdBy: params.createdBy,
        updateId: params.updateId,
      })
      .returning({
        id: schema.documentVersions.id,
        documentId: schema.documentVersions.documentId,
        kind: schema.documentVersions.kind,
        name: schema.documentVersions.name,
        createdBy: schema.documentVersions.createdBy,
        createdAt: schema.documentVersions.createdAt,
        updateId: schema.documentVersions.updateId,
      });

    return toVersionView(row);
  }
}
