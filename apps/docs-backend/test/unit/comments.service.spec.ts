import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CommentView } from '../../src/comment/comment.models';
import { CommentRepository } from '../../src/comment/comment.repository';
import { CommentService } from '../../src/comment/comment.service';
import { AccessPolicyService } from '../../src/permission/access-policy.service';
import type { EffectiveAccessLevel } from '../../src/permission/permission.models';

const AUTHOR_ID = 'user-author';
const OTHER_ID = 'user-other';
const OUTSIDER_ID = 'user-outsider';
const DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000001';
const OTHER_DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000002';
const ROOT_ID = '0192f5b0-1c00-7000-8000-000000000003';
const REPLY_ID = '0192f5b0-1c00-7000-8000-000000000004';

const commentRepository = {
  create: vi.fn(),
  listByDocument: vi.fn(),
  findById: vi.fn(),
  updateBody: vi.fn(),
  resolve: vi.fn(),
  remove: vi.fn(),
};

const accessPolicy = {
  assertDocumentAccess: vi.fn(),
};

const commentOf = (overrides: Partial<CommentView> = {}): CommentView => ({
  id: ROOT_ID,
  documentId: DOCUMENT_ID,
  parentId: null,
  authorId: AUTHOR_ID,
  body: 'Фраза под вопросом',
  anchor: null,
  resolvedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const allow = (level: EffectiveAccessLevel) => {
  accessPolicy.assertDocumentAccess.mockResolvedValue(level);
};

const deny = () => {
  accessPolicy.assertDocumentAccess.mockRejectedValue(new NotFoundException());
};

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: CommentRepository, useValue: commentRepository },
        { provide: AccessPolicyService, useValue: accessPolicy },
      ],
    }).compile();

    service = moduleRef.get(CommentService);
  });

  describe('list', () => {
    it('отдаёт дерево вместе с правами на кнопки', async () => {
      allow('commenter');
      commentRepository.listByDocument.mockResolvedValue([commentOf()]);

      const result = await service.list({
        documentId: DOCUMENT_ID,
        actorId: AUTHOR_ID,
      });

      expect(accessPolicy.assertDocumentAccess).toHaveBeenCalledWith({
        documentId: DOCUMENT_ID,
        principal: { userId: AUTHOR_ID },
        required: 'viewer',
      });
      expect(result.items).toHaveLength(1);
      expect(result.access).toEqual({
        canComment: true,
        canResolve: false,
      });
    });

    it('не открывает список чужого документа', async () => {
      deny();

      await expect(
        service.list({ documentId: DOCUMENT_ID, actorId: OUTSIDER_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(commentRepository.listByDocument).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('создаёт корневой комментарий от имени commenter', async () => {
      allow('commenter');
      commentRepository.create.mockResolvedValue(commentOf());

      await service.create({
        documentId: DOCUMENT_ID,
        actorId: AUTHOR_ID,
        body: 'Фраза под вопросом',
      });

      expect(accessPolicy.assertDocumentAccess).toHaveBeenCalledWith({
        documentId: DOCUMENT_ID,
        principal: { userId: AUTHOR_ID },
        required: 'commenter',
      });
      expect(commentRepository.create).toHaveBeenCalledWith({
        documentId: DOCUMENT_ID,
        parentId: null,
        authorId: AUTHOR_ID,
        body: 'Фраза под вопросом',
        anchor: null,
      });
    });

    it('не даёт viewer оставить комментарий', async () => {
      accessPolicy.assertDocumentAccess.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        service.create({
          documentId: DOCUMENT_ID,
          actorId: AUTHOR_ID,
          body: 'Текст',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(commentRepository.create).not.toHaveBeenCalled();
    });

    it('отвечает «не найдено», если родителя нет', async () => {
      allow('commenter');
      commentRepository.findById.mockResolvedValue(null);

      await expect(
        service.create({
          documentId: DOCUMENT_ID,
          actorId: AUTHOR_ID,
          body: 'Ответ',
          parentId: ROOT_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(commentRepository.create).not.toHaveBeenCalled();
    });

    it('не принимает родителя из другого документа', async () => {
      allow('commenter');
      commentRepository.findById.mockResolvedValue(
        commentOf({ documentId: OTHER_DOCUMENT_ID }),
      );

      await expect(
        service.create({
          documentId: DOCUMENT_ID,
          actorId: AUTHOR_ID,
          body: 'Ответ',
          parentId: ROOT_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(commentRepository.create).not.toHaveBeenCalled();
    });

    it('не принимает ответ на ответ', async () => {
      allow('commenter');
      commentRepository.findById.mockResolvedValue(
        commentOf({ parentId: ROOT_ID }),
      );

      await expect(
        service.create({
          documentId: DOCUMENT_ID,
          actorId: AUTHOR_ID,
          body: 'Ответ на ответ',
          parentId: REPLY_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(commentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('даёт автору переписать своё сообщение', async () => {
      allow('commenter');
      commentRepository.findById.mockResolvedValue(commentOf());
      commentRepository.updateBody.mockResolvedValue(
        commentOf({ body: 'Новая формулировка' }),
      );

      const updated = await service.update({
        commentId: ROOT_ID,
        actorId: AUTHOR_ID,
        body: 'Новая формулировка',
      });

      expect(commentRepository.updateBody).toHaveBeenCalledWith(
        ROOT_ID,
        'Новая формулировка',
      );
      expect(updated.body).toBe('Новая формулировка');
    });

    it('не даёт editor править чужое сообщение', async () => {
      allow('editor');
      commentRepository.findById.mockResolvedValue(commentOf());

      await expect(
        service.update({
          commentId: ROOT_ID,
          actorId: OTHER_ID,
          body: 'Правка',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(commentRepository.updateBody).not.toHaveBeenCalled();
    });

    it('не открывает комментарий чужого документа', async () => {
      deny();
      commentRepository.findById.mockResolvedValue(commentOf());

      await expect(
        service.update({
          commentId: ROOT_ID,
          actorId: OUTSIDER_ID,
          body: 'Правка',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(commentRepository.updateBody).not.toHaveBeenCalled();
    });
  });

  describe('resolve', () => {
    it('резолвит корень при уровне editor', async () => {
      allow('editor');
      commentRepository.findById.mockResolvedValue(commentOf());
      commentRepository.resolve.mockResolvedValue(
        commentOf({ resolvedAt: '2026-01-02T00:00:00.000Z' }),
      );

      const resolved = await service.resolve({
        commentId: ROOT_ID,
        actorId: OTHER_ID,
      });

      expect(commentRepository.resolve).toHaveBeenCalledWith(ROOT_ID);
      expect(resolved.resolvedAt).not.toBeNull();
    });

    it('не резолвит ответ', async () => {
      allow('editor');
      commentRepository.findById.mockResolvedValue(
        commentOf({ id: REPLY_ID, parentId: ROOT_ID }),
      );

      await expect(
        service.resolve({ commentId: REPLY_ID, actorId: OTHER_ID }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(commentRepository.resolve).not.toHaveBeenCalled();
    });

    it('не даёт commenter резолвить ветку', async () => {
      accessPolicy.assertDocumentAccess.mockRejectedValue(
        new ForbiddenException(),
      );
      commentRepository.findById.mockResolvedValue(commentOf());

      await expect(
        service.resolve({ commentId: ROOT_ID, actorId: AUTHOR_ID }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(commentRepository.resolve).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('даёт автору удалить своё сообщение', async () => {
      allow('commenter');
      commentRepository.findById.mockResolvedValue(commentOf());
      commentRepository.remove.mockResolvedValue(true);

      await service.remove({ commentId: ROOT_ID, actorId: AUTHOR_ID });

      expect(commentRepository.remove).toHaveBeenCalledWith(ROOT_ID);
    });

    it('даёт editor удалить чужое сообщение', async () => {
      allow('editor');
      commentRepository.findById.mockResolvedValue(commentOf());
      commentRepository.remove.mockResolvedValue(true);

      await service.remove({ commentId: ROOT_ID, actorId: OTHER_ID });

      expect(commentRepository.remove).toHaveBeenCalledWith(ROOT_ID);
    });

    it('не даёт commenter удалить чужое сообщение', async () => {
      allow('commenter');
      commentRepository.findById.mockResolvedValue(commentOf());

      await expect(
        service.remove({ commentId: ROOT_ID, actorId: OTHER_ID }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(commentRepository.remove).not.toHaveBeenCalled();
    });

    it('не открывает комментарий чужого документа', async () => {
      deny();
      commentRepository.findById.mockResolvedValue(commentOf());

      await expect(
        service.remove({ commentId: ROOT_ID, actorId: OUTSIDER_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(commentRepository.remove).not.toHaveBeenCalled();
    });
  });
});
