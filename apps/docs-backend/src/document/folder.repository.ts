import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DbExecutor,
} from '../database/database.constants';
import * as schema from '../database/schema';
import type { FolderChanges, FolderView } from './folder.models';

type FolderRow = typeof schema.folders.$inferSelect;

type FolderContentRow = {
  folders: number;
  documents: number;
} & Record<string, unknown>;

const toFolderView = (row: FolderRow): FolderView => ({
  id: row.id,
  organizationId: row.organizationId,
  parentId: row.parentId,
  name: row.name,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class FolderRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async create(
    data: typeof schema.folders.$inferInsert,
    db: DbExecutor = this.db,
  ): Promise<FolderView> {
    const [folder] = await db.insert(schema.folders).values(data).returning();

    return toFolderView(folder);
  }

  public async findById(
    folderId: string,
    db: DbExecutor = this.db,
  ): Promise<FolderView | null> {
    const folder = await db.query.folders.findFirst({
      where: { id: folderId },
    });

    return folder ? toFolderView(folder) : null;
  }

  public async findByIdInOrganization(
    folderId: string,
    organizationId: string,
    db: DbExecutor = this.db,
  ): Promise<FolderView | null> {
    const folder = await db.query.folders.findFirst({
      where: { id: folderId, organizationId },
    });

    return folder ? toFolderView(folder) : null;
  }

  // Перемещения папок в организации сериализуются advisory-локом до конца
  // транзакции: проверка цикла и запись должны видеть одно дерево, иначе два
  // встречных перемещения проходят проверку одновременно и создают цикл.
  public async lockMovesInOrganization(
    organizationId: string,
    db: DbExecutor,
  ): Promise<void> {
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtext(${organizationId}))`,
    );
  }

  public async listByOrganization(
    organizationId: string,
  ): Promise<FolderView[]> {
    const folders = await this.db
      .select()
      .from(schema.folders)
      .where(eq(schema.folders.organizationId, organizationId))
      .orderBy(asc(schema.folders.name));

    return folders.map(toFolderView);
  }

  public async update(
    folderId: string,
    changes: FolderChanges,
    db: DbExecutor = this.db,
  ): Promise<FolderView | null> {
    const set = {
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.parentId === undefined ? {} : { parentId: changes.parentId }),
      updatedAt: sql`NOW()`,
    };

    const [folder] = await db
      .update(schema.folders)
      .set(set)
      .where(eq(schema.folders.id, folderId))
      .returning();

    return folder ? toFolderView(folder) : null;
  }

  // Удалять можно только пустую папку: и подпапки, и документы считаем здесь,
  // а не в сервисе, чтобы проверка и удаление шли в одной транзакции.
  public async countContent(
    folderId: string,
    db: DbExecutor = this.db,
  ): Promise<{ folders: number; documents: number }> {
    const result = await db.execute<FolderContentRow>(sql`
      select
        (select count(*)::int from document.folders where parent_id = ${folderId}) as folders,
        (select count(*)::int from document.documents where folder_id = ${folderId}) as documents
    `);

    return result.rows[0] ?? { folders: 0, documents: 0 };
  }

  public async remove(
    folderId: string,
    db: DbExecutor = this.db,
  ): Promise<boolean> {
    const removed = await db
      .delete(schema.folders)
      .where(eq(schema.folders.id, folderId))
      .returning({ id: schema.folders.id });

    return removed.length > 0;
  }

  // Проверка цикла: `candidateId` лежит в поддереве `ancestorId`. Нужна при
  // перемещении папки в собственного потомка.
  public async isInSubtree(
    ancestorId: string,
    candidateId: string,
    db: DbExecutor = this.db,
  ): Promise<boolean> {
    const result = await db.execute<{ found: boolean }>(sql`
      with recursive subtree as (
        select id
        from document.folders
        where id = ${ancestorId}
        union
        select f.id
        from document.folders f
        join subtree s on f.parent_id = s.id
      )
      select exists(select 1 from subtree where id = ${candidateId}) as found
    `);

    return result.rows[0]?.found ?? false;
  }
}
