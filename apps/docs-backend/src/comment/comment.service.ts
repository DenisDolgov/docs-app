import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AccessPolicyService } from '../permission/access-policy.service';
import { hasAccess } from '../permission/permission.constants';
import type { EffectiveAccessLevel } from '../permission/permission.models';
import { COMMENT_MAX_DEPTH } from './comment.constants';
import type {
  CommentList,
  CommentView,
  CreateCommentParams,
  ListCommentsParams,
  RemoveCommentParams,
  ResolveCommentParams,
  UpdateCommentParams,
} from './comment.models';
import { CommentRepository } from './comment.repository';
import {
  type CommentAnchor,
  InvalidCommentAnchorError,
  normalizeCommentAnchor,
} from './comment-anchor';
import {
  COMMENT_ANCHOR_ERROR,
  COMMENT_FORBIDDEN_ERROR,
  COMMENT_NOT_FOUND_ERROR,
  COMMENT_PARENT_DOCUMENT_ERROR,
  COMMENT_REPLY_DEPTH_ERROR,
  COMMENT_ROOT_ONLY_ERROR,
} from './errors';

@Injectable()
export class CommentService {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  // `access` едет вместе с деревом: панель не должна угадывать права по роли
  // share и не делает второй запрос.
  async list({
    documentId,
    actorId,
  }: ListCommentsParams): Promise<CommentList> {
    const level = await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'viewer',
    });

    return {
      items: await this.commentRepository.listByDocument(documentId),
      access: {
        canComment: hasAccess(level, 'commenter'),
        canResolve: hasAccess(level, 'editor'),
      },
    };
  }

  async create({
    documentId,
    actorId,
    body,
    parentId,
    anchor,
  }: CreateCommentParams): Promise<CommentView> {
    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: actorId },
      required: 'commenter',
    });

    if (parentId !== undefined) {
      await this.assertReplyParent({ parentId, documentId });
    }

    return this.commentRepository.create({
      documentId,
      parentId: parentId ?? null,
      authorId: actorId,
      body,
      anchor: this.normalizeAnchor(anchor),
    });
  }

  // Правка — только автор
  async update({
    commentId,
    actorId,
    body,
  }: UpdateCommentParams): Promise<CommentView> {
    const comment = await this.requireComment(commentId);

    await this.assertDocumentLevel(comment, actorId, 'commenter');

    if (comment.authorId !== actorId) {
      throw new ForbiddenException(COMMENT_FORBIDDEN_ERROR);
    }

    const updated = await this.commentRepository.updateBody(commentId, body);

    if (!updated) throw new NotFoundException(COMMENT_NOT_FOUND_ERROR);

    return updated;
  }

  async resolve({
    commentId,
    actorId,
  }: ResolveCommentParams): Promise<CommentView> {
    const comment = await this.requireComment(commentId);

    await this.assertDocumentLevel(comment, actorId, 'editor');

    if (comment.parentId !== null) {
      throw new BadRequestException(COMMENT_ROOT_ONLY_ERROR);
    }

    const resolved = await this.commentRepository.resolve(commentId);

    if (!resolved) throw new NotFoundException(COMMENT_NOT_FOUND_ERROR);

    return resolved;
  }

  // Удалить может автор или `editor`: авторство не даёт права писать после
  // потери уровня `commenter`, поэтому общий уровень проверяется первым.
  async remove({ commentId, actorId }: RemoveCommentParams): Promise<void> {
    const comment = await this.requireComment(commentId);
    const level = await this.assertDocumentLevel(comment, actorId, 'commenter');

    if (comment.authorId !== actorId && !hasAccess(level, 'editor')) {
      throw new ForbiddenException(COMMENT_FORBIDDEN_ERROR);
    }

    // Удаление корня уносит ответы: FK с ON DELETE cascade задаётся схемой.
    const removed = await this.commentRepository.remove(commentId);

    if (!removed) throw new NotFoundException(COMMENT_NOT_FOUND_ERROR);
  }

  private async assertReplyParent({
    parentId,
    documentId,
  }: {
    parentId: string;
    documentId: string;
  }): Promise<void> {
    const parent = await this.commentRepository.findById(parentId);

    if (!parent) throw new NotFoundException(COMMENT_NOT_FOUND_ERROR);

    // Родитель из другого документа — не 404, а неверный запрос: документ
    // пользователю виден. FK пары `(document_id, parent_id)` страхует БД.
    if (parent.documentId !== documentId) {
      throw new BadRequestException(COMMENT_PARENT_DOCUMENT_ERROR);
    }

    const depth = parent.parentId === null ? 1 : 2;

    if (depth > COMMENT_MAX_DEPTH) {
      throw new BadRequestException(COMMENT_REPLY_DEPTH_ERROR);
    }
  }

  private normalizeAnchor(
    anchor: CommentAnchor | undefined,
  ): CommentAnchor | null {
    if (anchor === undefined) return null;

    try {
      return normalizeCommentAnchor(anchor);
    } catch (error: unknown) {
      if (error instanceof InvalidCommentAnchorError) {
        throw new BadRequestException(COMMENT_ANCHOR_ERROR);
      }

      throw error;
    }
  }

  private async requireComment(commentId: string): Promise<CommentView> {
    const comment = await this.commentRepository.findById(commentId);

    if (!comment) throw new NotFoundException(COMMENT_NOT_FOUND_ERROR);

    return comment;
  }

  // Уровень проверяется от документа комментария: подделанный `commentId` не
  // должен открывать чужое обсуждение, поэтому нет доступа — 404.
  private async assertDocumentLevel(
    comment: CommentView,
    actorId: string,
    required: EffectiveAccessLevel,
  ) {
    return this.accessPolicy.assertDocumentAccess({
      documentId: comment.documentId,
      principal: { userId: actorId },
      required,
    });
  }
}
