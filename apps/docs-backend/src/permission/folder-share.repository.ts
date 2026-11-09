import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import {
  DATABASE,
  type Database,
  type DbExecutor,
} from '../database/database.constants';
import * as schema from '../database/schema';
import type {
  FolderShareListItem,
  FolderShareView,
  GrantFolderShareParams,
} from './permission.models';

type FolderShareRow = typeof schema.folderShares.$inferSelect;

export const toFolderShareView = (row: FolderShareRow): FolderShareView => ({
  id: row.id,
  folderId: row.folderId,
  userId: row.userId,
  role: row.role,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class FolderShareRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async upsert(
    { folderId, userId, role, actorId }: GrantFolderShareParams,
    db: DbExecutor = this.db,
  ): Promise<FolderShareView> {
    const [row] = await db
      .insert(schema.folderShares)
      .values({ folderId, userId, role, createdBy: actorId })
      .onConflictDoUpdate({
        target: [schema.folderShares.folderId, schema.folderShares.userId],
        set: { role },
      })
      .returning();

    return toFolderShareView(row);
  }

  public async findByFolderAndUser(
    folderId: string,
    userId: string,
  ): Promise<FolderShareView | null> {
    const row = await this.db.query.folderShares.findFirst({
      where: { folderId, userId },
    });

    return row ? toFolderShareView(row) : null;
  }

  public async listByFolder(folderId: string): Promise<FolderShareListItem[]> {
    const rows = await this.db
      .select({
        id: schema.folderShares.id,
        folderId: schema.folderShares.folderId,
        userId: schema.folderShares.userId,
        role: schema.folderShares.role,
        createdBy: schema.folderShares.createdBy,
        createdAt: schema.folderShares.createdAt,
        email: schema.users.email,
      })
      .from(schema.folderShares)
      .innerJoin(schema.users, eq(schema.folderShares.userId, schema.users.id))
      .where(eq(schema.folderShares.folderId, folderId))
      .orderBy(desc(schema.folderShares.createdAt));

    return rows.map((row) => ({
      ...toFolderShareView(row),
      email: row.email,
    }));
  }

  public async deleteByFolderAndUser(
    folderId: string,
    userId: string,
    db: DbExecutor = this.db,
  ): Promise<boolean> {
    const rows = await db
      .delete(schema.folderShares)
      .where(
        and(
          eq(schema.folderShares.folderId, folderId),
          eq(schema.folderShares.userId, userId),
        ),
      )
      .returning({ id: schema.folderShares.id });

    return rows.length > 0;
  }
}
