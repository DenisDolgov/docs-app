import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import * as schema from '../../src/database/schema';
import { createTestApp, readAccessToken } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

const anchorFixture = () => {
  const doc = new Y.Doc();
  const text = doc.getText('e2e');
  text.insert(0, 'фрагмент текста');

  const encode = (position: Y.RelativePosition) =>
    Buffer.from(Y.encodeRelativePosition(position)).toString('base64');

  return {
    start: encode(Y.createRelativePositionFromTypeIndex(text, 0)),
    end: encode(Y.createRelativePositionFromTypeIndex(text, 8)),
    quote: 'фрагмент',
  };
};

describe('comments (e2e)', () => {
  let app: INestApplication;
  let db: Database;
  let close: () => Promise<void>;

  const registerAndLogin = async () => {
    const email = nextEmail();

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    expect(registered.status).toBe(201);

    await app.get(UserRepository).markEmailVerified(registered.body.id);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    return {
      email,
      id: registered.body.id as string,
      accessToken: readAccessToken(res),
    };
  };

  const createDocument = async (accessToken: string) => {
    const res = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Документ с комментариями' });

    expect(res.status).toBe(201);

    return res.body.id as string;
  };

  const grantShare = (
    accessToken: string,
    documentId: string,
    email: string,
    role: 'viewer' | 'commenter' | 'editor',
  ) =>
    request(app.getHttpServer())
      .post(`/documents/${documentId}/shares`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email, role });

  const listComments = (accessToken: string, documentId: string) =>
    request(app.getHttpServer())
      .get(`/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`);

  const createComment = (
    accessToken: string,
    documentId: string,
    payload: { body: string; parentId?: string; anchor?: unknown },
  ) =>
    request(app.getHttpServer())
      .post(`/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload);

  const updateComment = (
    accessToken: string,
    commentId: string,
    body: string,
  ) =>
    request(app.getHttpServer())
      .patch(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ body });

  const resolveComment = (accessToken: string, commentId: string) =>
    request(app.getHttpServer())
      .post(`/comments/${commentId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`);

  const removeComment = (accessToken: string, commentId: string) =>
    request(app.getHttpServer())
      .delete(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${accessToken}`);

  // Четыре участника на каждый сценарий: владелец, viewer, commenter, editor.
  const setup = async () => {
    const owner = await registerAndLogin();
    const documentId = await createDocument(owner.accessToken);

    const viewer = await registerAndLogin();
    const commenter = await registerAndLogin();
    const editor = await registerAndLogin();

    for (const [user, role] of [
      [viewer, 'viewer'],
      [commenter, 'commenter'],
      [editor, 'editor'],
    ] as const) {
      const granted = await grantShare(
        owner.accessToken,
        documentId,
        user.email,
        role,
      );

      expect(granted.status).toBe(201);
    }

    return { owner, viewer, commenter, editor, documentId };
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.init();

    db = app.get(DATABASE);
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('viewer читает обсуждение, но не создаёт и не меняет его', async () => {
    const { owner, viewer, documentId } = await setup();

    const created = await createComment(owner.accessToken, documentId, {
      body: 'Фраза под вопросом',
    });

    expect(created.status).toBe(201);

    const listed = await listComments(viewer.accessToken, documentId);

    expect(listed.status).toBe(200);
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.access).toEqual({
      canComment: false,
      canResolve: false,
    });

    const deniedCreate = await createComment(viewer.accessToken, documentId, {
      body: 'Мне тоже есть что сказать',
    });

    expect(deniedCreate.status).toBe(403);

    const deniedUpdate = await updateComment(
      viewer.accessToken,
      created.body.id,
      'Подмена',
    );

    expect(deniedUpdate.status).toBe(403);
  });

  it('commenter создаёт, правит и удаляет своё сообщение', async () => {
    const { commenter, documentId } = await setup();

    const created = await createComment(commenter.accessToken, documentId, {
      body: 'Первая версия',
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      documentId,
      parentId: null,
      authorId: commenter.id,
      body: 'Первая версия',
      anchor: null,
      resolvedAt: null,
    });

    const updated = await updateComment(
      commenter.accessToken,
      created.body.id,
      'Уточнённая версия',
    );

    expect(updated.status).toBe(200);
    expect(updated.body.body).toBe('Уточнённая версия');

    const removed = await removeComment(commenter.accessToken, created.body.id);

    expect(removed.status).toBe(204);

    const listed = await listComments(commenter.accessToken, documentId);

    expect(listed.body.items).toHaveLength(0);
  });

  it('editor резолвит и удаляет чужое, commenter — нет', async () => {
    const { commenter, editor, documentId } = await setup();

    const created = await createComment(commenter.accessToken, documentId, {
      body: 'Обсудить',
    });

    expect(created.status).toBe(201);

    const denied = await resolveComment(commenter.accessToken, created.body.id);

    expect(denied.status).toBe(403);

    const resolved = await resolveComment(editor.accessToken, created.body.id);

    expect(resolved.status).toBe(200);
    expect(resolved.body.resolvedAt).not.toBeNull();

    const second = await resolveComment(editor.accessToken, created.body.id);

    expect(second.status).toBe(200);
    expect(second.body.resolvedAt).toBe(resolved.body.resolvedAt);

    const another = await createComment(editor.accessToken, documentId, {
      body: 'Ветка от editor',
    });

    expect(another.status).toBe(201);

    const deniedDeleteOther = await removeComment(
      commenter.accessToken,
      another.body.id,
    );

    // commenter чужое не удаляет, даже если видит ветку.
    expect(deniedDeleteOther.status).toBe(403);

    const editorRemoves = await removeComment(
      editor.accessToken,
      another.body.id,
    );

    expect(editorRemoves.status).toBe(204);
  });

  it('разрешает ответ только в корень и только в свой документ', async () => {
    const { commenter, documentId } = await setup();

    const root = await createComment(commenter.accessToken, documentId, {
      body: 'Корень',
    });

    const reply = await createComment(commenter.accessToken, documentId, {
      body: 'Ответ в корень',
      parentId: root.body.id,
    });

    expect(reply.status).toBe(201);
    expect(reply.body.parentId).toBe(root.body.id);

    const nested = await createComment(commenter.accessToken, documentId, {
      body: 'Ответ на ответ',
      parentId: reply.body.id,
    });

    expect(nested.status).toBe(400);

    const otherDocumentId = await createDocument(commenter.accessToken);
    const foreignParent = await createComment(
      commenter.accessToken,
      otherDocumentId,
      {
        body: 'Чужой родитель',
        parentId: root.body.id,
      },
    );

    expect(foreignParent.status).toBe(400);
  });

  it('не открывает обсуждение чужого документа', async () => {
    const { commenter, documentId } = await setup();
    const outsider = await registerAndLogin();

    const created = await createComment(commenter.accessToken, documentId, {
      body: 'Скрыто от посторонних',
    });

    expect(created.status).toBe(201);

    const listed = await listComments(outsider.accessToken, documentId);
    expect(listed.status).toBe(404);

    const updated = await updateComment(
      outsider.accessToken,
      created.body.id,
      'Подмена',
    );
    expect(updated.status).toBe(404);

    const removed = await removeComment(outsider.accessToken, created.body.id);
    expect(removed.status).toBe(404);
  });

  it('проверяет тело и якорь до записи', async () => {
    const { commenter, documentId } = await setup();

    const tooLong = await createComment(commenter.accessToken, documentId, {
      body: 'a'.repeat(5001),
    });
    expect(tooLong.status).toBe(400);

    const empty = await createComment(commenter.accessToken, documentId, {
      body: '   ',
    });
    expect(empty.status).toBe(400);

    const garbageAnchor = await createComment(
      commenter.accessToken,
      documentId,
      {
        body: 'С мусорным якорем',
        anchor: { start: 'не base64?', end: 'не base64?', quote: 'кусок' },
      },
    );
    expect(garbageAnchor.status).toBe(400);
  });

  it('сохраняет якорь и отдаёт его в списке', async () => {
    const { commenter, documentId } = await setup();
    const anchor = anchorFixture();

    const created = await createComment(commenter.accessToken, documentId, {
      body: 'Со ссылкой на фрагмент',
      anchor,
    });

    expect(created.status).toBe(201);
    expect(created.body.anchor).toEqual(anchor);

    const listed = await listComments(commenter.accessToken, documentId);

    expect(listed.body.items[0].anchor).toEqual(anchor);
  });

  it('удаляет комментарии вместе с документом', async () => {
    const { owner, commenter, documentId } = await setup();

    const created = await createComment(commenter.accessToken, documentId, {
      body: 'Уйдёт вместе с документом',
    });

    expect(created.status).toBe(201);

    const removed = await request(app.getHttpServer())
      .delete(`/documents/${documentId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(removed.status).toBe(204);

    const left = await db
      .select({ id: schema.comments.id })
      .from(schema.comments)
      .where(eq(schema.comments.documentId, documentId));

    expect(left).toEqual([]);
  });
});
