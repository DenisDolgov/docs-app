import type { DocumentAccessLevel } from '@docs-app/contracts/document';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DATABASE, type Database } from '../database/database.constants';
import type { FolderAccessFacts } from './permission.models';

type FolderFactsRow = {
  organization_id: string;
  created_by: string;
} & Record<string, unknown>;

type ShareLevelRow = {
  role: DocumentAccessLevel;
} & Record<string, unknown>;

type DocumentIdRow = {
  id: string;
} & Record<string, unknown>;

// Read-модель прав на папки. Модуль прав не импортирует модуль документов:
// он читает `document.folders` и `permission.folder_shares` напрямую, чтобы не
// получился цикл модулей.
@Injectable()
export class FolderAccessRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async findFolderFacts(
    folderId: string,
  ): Promise<FolderAccessFacts | null> {
    const result = await this.db.execute<FolderFactsRow>(sql`
      select organization_id, created_by
      from document.folders
      where id = ${folderId}
      limit 1
    `);

    const row = result.rows[0];

    return row
      ? { organizationId: row.organization_id, createdBy: row.created_by }
      : null;
  }

  // Все уровни share'ов пользователя на папку и её предков. Порядок и
  // количество строк политике не важны: она берёт максимум.
  public async findShareLevelsByFolderChain(
    folderId: string,
    userId: string,
  ): Promise<DocumentAccessLevel[]> {
    const result = await this.db.execute<ShareLevelRow>(sql`
      with recursive chain as (
        select id, parent_id
        from document.folders
        where id = ${folderId}
        union all
        select f.id, f.parent_id
        from document.folders f
        join chain c on f.id = c.parent_id
      )
      select distinct fs.role
      from permission.folder_shares fs
      join chain c on c.id = fs.folder_id
      where fs.user_id = ${userId}
    `);

    return result.rows.map((row) => row.role);
  }

  // Документы во всей папке и её поддереве: по ним инвалидируется кэш права.
  public async findDescendantDocumentIds(folderId: string): Promise<string[]> {
    const result = await this.db.execute<DocumentIdRow>(sql`
      with recursive subtree as (
        select id
        from document.folders
        where id = ${folderId}
        union
        select f.id
        from document.folders f
        join subtree s on f.parent_id = s.id
      )
      select d.id
      from document.documents d
      join subtree s on s.id = d.folder_id
      where d.folder_id is not null
    `);

    return result.rows.map((row) => row.id);
  }
}
