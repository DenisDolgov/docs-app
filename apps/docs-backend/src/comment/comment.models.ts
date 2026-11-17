import type { CommentAnchor } from './comment-anchor';

export interface CommentView {
  id: string;
  documentId: string;
  parentId: string | null;
  authorId: string;
  body: string;
  anchor: CommentAnchor | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Что панель вправе показать: считается по эффективному уровню документа, а не
// по роли share.
export interface CommentAccess {
  canComment: boolean;
  canResolve: boolean;
}

export interface CommentList {
  items: CommentView[];
  access: CommentAccess;
}

export interface ListCommentsParams {
  documentId: string;
  actorId: string;
}

export interface CreateCommentParams {
  documentId: string;
  actorId: string;
  body: string;
  parentId?: string;
  anchor?: CommentAnchor;
}

export interface UpdateCommentParams {
  commentId: string;
  actorId: string;
  body: string;
}

export interface ResolveCommentParams {
  commentId: string;
  actorId: string;
}

export interface RemoveCommentParams {
  commentId: string;
  actorId: string;
}

// Внутренняя форма вставки: сервис уже проверил права и родителя.
export interface CreateCommentRecordParams {
  documentId: string;
  parentId: string | null;
  authorId: string;
  body: string;
  anchor: CommentAnchor | null;
}
