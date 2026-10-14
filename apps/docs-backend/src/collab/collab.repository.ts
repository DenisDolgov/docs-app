import { Inject, Injectable } from '@nestjs/common';
import { and, eq, lt, lte } from 'drizzle-orm';

import { DATABASE, Database } from '../database/database.constants';
import * as schema from '../database/schema';

@Injectable()
export class CollabRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async appendUpdate(documentId: string, update: Uint8Array) {
    const [record] = await this.db
      .insert(schema.documentUpdates)
      .values({
        documentId,
        update,
      })
      .returning({
        id: schema.documentUpdates.id,
      });

    return record.id;
  }

  public async appendUpdates(documentId: string, updates: Uint8Array[]) {
    await this.db
      .insert(schema.documentUpdates)
      .values(
        updates.map((update) => ({
          update,
          documentId,
        })),
      )
      .returning({
        id: schema.documentUpdates.id,
      });
  }

  public async listUpdates(documentId: string) {
    const records = await this.db.query.documentUpdates.findMany({
      where: { documentId },
      columns: {
        update: true,
      },
    });

    return records.map((record) => record.update);
  }

  public async loadSnapshot(documentId: string) {
    const record = await this.db.query.documentSnapshots.findFirst({
      where: { documentId },
      columns: {
        snapshot: true,
      },
    });

    return record?.snapshot ?? null;
  }

  public async saveSnapshot(documentId: string, snapshot: Uint8Array) {
    return this.db
      .insert(schema.documentSnapshots)
      .values({
        documentId,
        snapshot,
      })
      .onConflictDoUpdate({
        target: schema.documentSnapshots.documentId,
        set: { snapshot },
      })
      .returning();
  }

  public async compact(
    documentId: string,
    snapshot: Uint8Array,
    lastUpdateId: number,
  ) {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(schema.documentSnapshots)
        .values({
          documentId,
          snapshot,
        })
        .onConflictDoUpdate({
          target: schema.documentSnapshots.documentId,
          set: { snapshot },
        });

      await tx
        .delete(schema.documentUpdates)
        .where(
          and(
            eq(schema.documentUpdates.documentId, documentId),
            lte(schema.documentUpdates.id, lastUpdateId),
          ),
        );
    });
  }

  public async getLastUpdate(documentId: string) {
    return this.db.query.documentUpdates.findFirst({
      where: { documentId },
      orderBy: (table, { desc }) => [desc(table.id)],
    });
  }
}
