import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, lt } from 'drizzle-orm';

import {
  DATABASE,
  Database,
  type DbExecutor,
} from '../database/database.constants';
import * as schema from '../database/schema';
import type {
  CreatePendingFileParams,
  FileView,
  VerifiedObject,
} from './file.models';

type FileRow = typeof schema.files.$inferSelect;

const toFileView = (row: FileRow): FileView => ({
  id: row.id,
  ownerId: row.ownerId,
  organizationId: row.organizationId,
  documentId: row.documentId,
  key: row.key,
  name: row.name,
  mime: row.mime,
  size: row.size,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class FileRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // Строка появляется до загрузки: в ней заявка клиента, а не факты объекта.
  public async createPending(
    data: CreatePendingFileParams,
    db: DbExecutor = this.db,
  ): Promise<FileView> {
    const [file] = await db
      .insert(schema.files)
      .values({ ...data, status: 'pending' })
      .returning();

    return toFileView(file);
  }

  public async findById(fileId: string): Promise<FileView | null> {
    const file = await this.db.query.files.findFirst({
      where: { id: fileId },
    });

    return file ? toFileView(file) : null;
  }

  // `ready` ставится только по проверенным фактам хранилища: размер и mime
  // приходят сюда уже не из запроса клиента.
  public async markReady(
    fileId: string,
    facts: VerifiedObject,
    db: DbExecutor = this.db,
  ): Promise<FileView | null> {
    const [file] = await db
      .update(schema.files)
      .set({ status: 'ready', size: facts.size, mime: facts.mime })
      .where(eq(schema.files.id, fileId))
      .returning();

    return file ? toFileView(file) : null;
  }

  public async listReadyByDocument(documentId: string): Promise<FileView[]> {
    const files = await this.db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.documentId, documentId),
          eq(schema.files.status, 'ready'),
        ),
      )
      .orderBy(asc(schema.files.createdAt));

    return files.map(toFileView);
  }

  public async remove(
    fileId: string,
    db: DbExecutor = this.db,
  ): Promise<boolean> {
    const removed = await db
      .delete(schema.files)
      .where(eq(schema.files.id, fileId))
      .returning({ id: schema.files.id });

    return removed.length > 0;
  }

  // Брошенные загрузки: `pending` старше окна. `ready` сюда не попадает,
  // даже если строка старая.
  public async findExpiredPending(cutoff: Date): Promise<FileView[]> {
    const files = await this.db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.status, 'pending'),
          lt(schema.files.createdAt, cutoff),
        ),
      )
      .orderBy(asc(schema.files.createdAt));

    return files.map(toFileView);
  }
}
