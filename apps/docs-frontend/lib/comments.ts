import type {
  CommentDto,
  CommentListResponseDto,
  CreateCommentDto,
  UpdateCommentDto,
} from '@docs-app/contracts/comment';
import { commentRoute } from '@docs-app/contracts/comment/routes';

import { apiJson } from '@/lib/api';

export type { CommentDto, CommentListResponseDto };

const { paths } = commentRoute;

export const listComments = (
  documentId: string,
): Promise<CommentListResponseDto> =>
  apiJson<CommentListResponseDto>(paths.list(documentId));

export const createComment = (
  documentId: string,
  comment: CreateCommentDto,
): Promise<CommentDto> =>
  apiJson<CommentDto>(paths.create(documentId), {
    method: 'POST',
    body: JSON.stringify(comment),
  });

export const updateComment = (
  commentId: string,
  body: UpdateCommentDto['body'],
): Promise<CommentDto> =>
  apiJson<CommentDto>(paths.byId(commentId), {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  });

export const resolveComment = (commentId: string): Promise<CommentDto> =>
  apiJson<CommentDto>(paths.resolve(commentId), { method: 'POST' });

export const removeComment = (commentId: string): Promise<void> =>
  apiJson<void>(paths.byId(commentId), { method: 'DELETE' });
