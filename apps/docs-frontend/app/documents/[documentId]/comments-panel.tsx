'use client';

import {
  CheckIcon,
  MessageSquareIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import {
  type CommentDto,
  type CommentListResponseDto,
  createComment,
  listComments,
  removeComment,
  resolveComment,
  updateComment,
} from '@/lib/comments';
import {
  type CommentRange,
  createCommentAnchor,
  resolveCommentAnchor,
  scrollToCommentAnchor,
  setCommentHighlights,
} from '@/lib/comments/anchor';
import { useEditorStore } from '@/store/use-editor-store';

const errorTitle = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const formatDate = (value: string): string =>
  new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const CommentsPanel = () => {
  const params = useParams<{ documentId: string }>();
  const { user } = useAuth();
  const { editor } = useEditorStore();

  const [data, setData] = useState<CommentListResponseDto | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await listComments(params.documentId));
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось загрузить комментарии'),
      });
    }
  }, [params.documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Якоря пересчитываются в абсолютные позиции, когда пришли комментарии или
  // сменился документ. Дальше декорации сами ездят вместе с текстом.
  useEffect(() => {
    if (!editor || !data) return;

    const ranges: CommentRange[] = [];

    for (const comment of data.items) {
      if (!comment.anchor) continue;

      const range = resolveCommentAnchor(editor, comment.anchor);

      if (range) ranges.push({ commentId: comment.id, ...range });
    }

    setCommentHighlights(editor, ranges, activeId);
  }, [editor, data, activeId]);

  const canComment = data?.access.canComment ?? false;
  const canResolve = data?.access.canResolve ?? false;

  const canEdit = (comment: CommentDto): boolean =>
    canComment && comment.authorId === user?.id;

  const canDelete = (comment: CommentDto): boolean =>
    comment.authorId === user?.id ? canComment : canResolve;

  const submitRoot = async () => {
    const body = draft.trim();

    if (!body) return;

    setBusy(true);

    try {
      const anchor = editor ? createCommentAnchor(editor) : null;

      await createComment(params.documentId, {
        body,
        ...(anchor ? { anchor } : {}),
      });
      setDraft('');
      setEditingId(null);
      toast.add({ type: 'success', title: 'Комментарий добавлен' });
      await load();
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось добавить комментарий'),
      });
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async (parentId: string) => {
    const body = replyDraft.trim();

    if (!body) return;

    setBusy(true);

    try {
      await createComment(params.documentId, { body, parentId });
      setReplyDraft('');
      setReplyTo(null);
      toast.add({ type: 'success', title: 'Ответ добавлен' });
      await load();
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось ответить'),
      });
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (commentId: string) => {
    const body = editDraft.trim();

    if (!body) return;

    setBusy(true);

    try {
      await updateComment(commentId, body);
      setEditingId(null);
      setEditDraft('');
      toast.add({ type: 'success', title: 'Комментарий обновлён' });
      await load();
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось изменить комментарий'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async (commentId: string) => {
    setBusy(true);

    try {
      await resolveComment(commentId);
      toast.add({ type: 'success', title: 'Ветка решена' });
      await load();
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось закрыть ветку'),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (comment: CommentDto) => {
    if (!window.confirm('Удалить комментарий?')) return;

    setBusy(true);

    try {
      await removeComment(comment.id);
      if (activeId === comment.id) setActiveId(null);
      toast.add({ type: 'success', title: 'Комментарий удалён' });
      await load();
    } catch (error: unknown) {
      toast.add({
        type: 'error',
        title: errorTitle(error, 'Не удалось удалить комментарий'),
      });
    } finally {
      setBusy(false);
    }
  };

  // Клик по комментарию: подсветить диапазон и прокрутить к нему. Якорь мог не
  // восстановиться — тогда просто делаем ветку активной.
  const focusComment = (comment: CommentDto) => {
    setActiveId(comment.id);

    if (!editor || !comment.anchor) return;

    scrollToCommentAnchor(editor, comment.anchor);
  };

  const roots = data?.items.filter((item) => item.parentId === null) ?? [];

  return (
    <aside className="sticky top-0 flex h-[calc(100vh-3.5rem)] w-80 shrink-0 flex-col border-l bg-white print:hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquareIcon className="size-4" />
        <h2 className="text-sm font-semibold">Комментарии</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {data === null ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : roots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Обсуждения пока нет.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {roots.map((comment) => {
              const replies =
                data.items.filter((item) => item.parentId === comment.id) ?? [];
              const resolved = comment.resolvedAt !== null;

              return (
                <li key={comment.id} className="flex flex-col gap-2">
                  <div
                    className={`rounded-lg border p-3 ${
                      activeId === comment.id ? 'border-ring' : 'bg-white'
                    } ${resolved ? 'opacity-60' : ''}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => focusComment(comment)}
                    >
                      {comment.anchor ? (
                        <blockquote className="mb-1 border-l-2 pl-2 text-xs italic text-muted-foreground">
                          «{comment.anchor.quote}»
                        </blockquote>
                      ) : null}
                      {editingId === comment.id ? null : (
                        <p className="whitespace-pre-wrap text-sm">
                          {comment.body}
                        </p>
                      )}
                    </button>

                    {editingId === comment.id ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <Textarea
                          value={editDraft}
                          onChange={(event) => setEditDraft(event.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <XIcon />
                            Отмена
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void submitEdit(comment.id)}
                          >
                            Сохранить
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {comment.authorId === user?.id ? 'Вы' : 'Участник'}
                          {' · '}
                          {formatDate(comment.createdAt)}
                          {resolved ? ' · решено' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          {canEdit(comment) ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Изменить комментарий"
                              onClick={() => {
                                setEditingId(comment.id);
                                setEditDraft(comment.body);
                              }}
                            >
                              <PencilIcon />
                            </Button>
                          ) : null}
                          {canDelete(comment) ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Удалить комментарий"
                              onClick={() => void handleRemove(comment)}
                            >
                              <Trash2Icon />
                            </Button>
                          ) : null}
                          {canResolve && !resolved ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Решить ветку"
                              onClick={() => void handleResolve(comment.id)}
                            >
                              <CheckIcon />
                            </Button>
                          ) : null}
                        </span>
                      </div>
                    )}
                  </div>

                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="ml-3 rounded-lg border bg-muted/40 p-2"
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => focusComment(reply)}
                      >
                        {editingId === reply.id ? null : (
                          <p className="whitespace-pre-wrap text-sm">
                            {reply.body}
                          </p>
                        )}
                      </button>

                      {editingId === reply.id ? (
                        <div className="mt-2 flex flex-col gap-2">
                          <Textarea
                            value={editDraft}
                            onChange={(event) =>
                              setEditDraft(event.target.value)
                            }
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              <XIcon />
                              Отмена
                            </Button>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => void submitEdit(reply.id)}
                            >
                              Сохранить
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {reply.authorId === user?.id ? 'Вы' : 'Участник'}
                            {' · '}
                            {formatDate(reply.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            {canEdit(reply) ? (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Изменить ответ"
                                onClick={() => {
                                  setEditingId(reply.id);
                                  setEditDraft(reply.body);
                                }}
                              >
                                <PencilIcon />
                              </Button>
                            ) : null}
                            {canDelete(reply) ? (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Удалить ответ"
                                onClick={() => void handleRemove(reply)}
                              >
                                <Trash2Icon />
                              </Button>
                            ) : null}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  {canComment ? (
                    replyTo === comment.id ? (
                      <div className="ml-3 flex flex-col gap-2">
                        <Textarea
                          value={replyDraft}
                          placeholder="Ответ"
                          onChange={(event) =>
                            setReplyDraft(event.target.value)
                          }
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyTo(null);
                              setReplyDraft('');
                            }}
                          >
                            <XIcon />
                            Отмена
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void submitReply(comment.id)}
                          >
                            <SendIcon />
                            Отправить
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-3 self-start"
                        onClick={() => {
                          setReplyTo(comment.id);
                          setReplyDraft('');
                        }}
                      >
                        Ответить
                      </Button>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canComment ? (
        <div className="flex flex-col gap-2 border-t p-4">
          <Textarea
            value={draft}
            placeholder="Что обсудить? Выделенный текст станет якорем."
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            size="sm"
            disabled={busy || draft.trim().length === 0}
            onClick={() => void submitRoot()}
          >
            <SendIcon />
            Комментировать
          </Button>
        </div>
      ) : null}
    </aside>
  );
};
