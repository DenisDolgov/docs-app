import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import {
  DATABASE,
  Database,
  type DbExecutor,
} from '../database/database.constants';
import * as schema from '../database/schema';
import type { CommentView, CreateCommentRecordParams } from './comment.models';

type CommentRow = typeof schema.comments.$inferSelect;

const toCommentView = (row: CommentRow): CommentView => ({
  id: row.id,
  documentId: row.documentId,
  parentId: row.parentId,
  authorId: row.authorId,
  body: row.body,
  anchor: row.anchor ?? null,
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class CommentRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(
    data: CreateCommentRecordParams,
    db: DbExecutor = this.db,
  ): Promise<CommentView> {
    const [comment] = await db.insert(schema.comments).values(data).returning();

    return toCommentView(comment);
  }

  // Дерево читается одним запросом: корни и ответы лежат в одной таблице.
  // Порядок задаёт `id` — он uuidv7, то есть уже упорядочен по времени вставки,
  // поэтому отдельный индекс по `createdAt` не нужен: хватает составного
  // `(document_id, id)`.
  async listByDocument(documentId: string): Promise<CommentView[]> {
    const comments = await this.db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.documentId, documentId))
      .orderBy(asc(schema.comments.id));

    return comments.map(toCommentView);
  }

  async findById(commentId: string): Promise<CommentView | null> {
    const [comment] = await this.db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.id, commentId))
      .limit(1);

    return comment ? toCommentView(comment) : null;
  }

  async updateBody(
    commentId: string,
    body: string,
    db: DbExecutor = this.db,
  ): Promise<CommentView | null> {
    const [comment] = await db
      .update(schema.comments)
      .set({ body, updatedAt: sql`NOW()` })
      .where(eq(schema.comments.id, commentId))
      .returning();

    return comment ? toCommentView(comment) : null;
  }

  // Повторный resolve не переписывает время: состояние уже наступило, и
  // идемпотентность важнее точной даты второго клика.
  async resolve(
    commentId: string,
    db: DbExecutor = this.db,
  ): Promise<CommentView | null> {
    const [comment] = await db
      .update(schema.comments)
      .set({
        resolvedAt: sql`COALESCE(${schema.comments.resolvedAt}, NOW())`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(schema.comments.id, commentId))
      .returning();

    return comment ? toCommentView(comment) : null;
  }

  async remove(commentId: string, db: DbExecutor = this.db): Promise<boolean> {
    const removed = await db
      .delete(schema.comments)
      .where(eq(schema.comments.id, commentId))
      .returning({ id: schema.comments.id });

    return removed.length > 0;
  }
}
