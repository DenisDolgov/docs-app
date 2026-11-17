import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CommentRepository } from '../../src/comment/comment.repository';
import { DocumentRepository } from '../../src/document/document.repository';
import { createTestingModule } from '../utils';

describe('комментарии (integration)', () => {
  let commentRepository: CommentRepository;
  let documentRepository: DocumentRepository;
  let close: () => Promise<void>;

  const createDocument = async () => {
    const document = await documentRepository.create({
      title: 'Обсуждение',
      createdBy: randomUUID(),
    });

    return document.id;
  };

  const createComment = (
    documentId: string,
    overrides: {
      parentId?: string | null;
      body?: string;
      authorId?: string;
    } = {},
  ) =>
    commentRepository.create({
      documentId,
      parentId: overrides.parentId ?? null,
      authorId: overrides.authorId ?? randomUUID(),
      body: overrides.body ?? 'Фраза под вопросом',
      anchor: null,
    });

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    commentRepository = moduleRef.get(CommentRepository);
    documentRepository = moduleRef.get(DocumentRepository);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('читает корни и ответы документа одним списком в порядке создания', async () => {
    const documentId = await createDocument();
    const root = await createComment(documentId, { body: 'Первый' });
    const reply = await createComment(documentId, {
      parentId: root.id,
      body: 'Ответ',
    });
    const secondRoot = await createComment(documentId, { body: 'Второй' });

    const items = await commentRepository.listByDocument(documentId);

    expect(items.map((item) => item.body)).toEqual([
      'Первый',
      'Ответ',
      'Второй',
    ]);
    expect(items.map((item) => item.id)).toEqual([
      root.id,
      reply.id,
      secondRoot.id,
    ]);
    expect(items[1].parentId).toBe(root.id);
    expect(items[2].parentId).toBeNull();
  });

  it('не отдаёт комментарии другого документа', async () => {
    const documentId = await createDocument();
    const otherDocumentId = await createDocument();

    await createComment(documentId, { body: 'Мой документ' });

    const items = await commentRepository.listByDocument(otherDocumentId);

    expect(items).toEqual([]);
  });

  it('обновляет тело и время изменения', async () => {
    const documentId = await createDocument();
    const comment = await createComment(documentId, { body: 'До' });

    const updated = await commentRepository.updateBody(
      comment.id,
      'После правки',
    );

    expect(updated?.body).toBe('После правки');
    expect(updated?.updatedAt).not.toBe(comment.updatedAt);
  });

  it('резолвит комментарий идемпотентно', async () => {
    const documentId = await createDocument();
    const comment = await createComment(documentId);

    const first = await commentRepository.resolve(comment.id);
    const second = await commentRepository.resolve(comment.id);

    expect(first?.resolvedAt).not.toBeNull();
    expect(second?.resolvedAt).toBe(first?.resolvedAt);
  });

  it('удаляет ответы вместе с корнем', async () => {
    const documentId = await createDocument();
    const root = await createComment(documentId);
    const reply = await createComment(documentId, { parentId: root.id });

    await commentRepository.remove(root.id);

    expect(await commentRepository.findById(root.id)).toBeNull();
    expect(await commentRepository.findById(reply.id)).toBeNull();
  });

  it('удаляет комментарии вместе с документом', async () => {
    const documentId = await createDocument();
    const comment = await createComment(documentId);

    await documentRepository.remove(documentId);

    expect(await commentRepository.findById(comment.id)).toBeNull();
    expect(await commentRepository.listByDocument(documentId)).toEqual([]);
  });
});
