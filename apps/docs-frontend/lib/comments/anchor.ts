import type { CommentAnchorDto } from '@docs-app/contracts/comment';
import { MAX_COMMENT_ANCHOR_QUOTE_LENGTH } from '@docs-app/contracts/comment/limits';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { type Editor, Extension } from '@tiptap/react';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from '@tiptap/y-tiptap';
import * as Y from 'yjs';

export interface CommentRange {
  commentId: string;
  from: number;
  to: number;
}

const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
};

const decodeBase64 = (value: string): Uint8Array | null => {
  try {
    const binary = atob(value);

    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
};

// Выделение → два конца в терминах CRDT. Абсолютные offset'ы здесь не годятся:
// они уезжают от любой правки выше по тексту.
export const createCommentAnchor = (
  editor: Editor,
): CommentAnchorDto | null => {
  const { from, to } = editor.state.selection;

  if (from === to) return null;

  const sync = ySyncPluginKey.getState(editor.state);

  if (!sync) return null;

  const start = absolutePositionToRelativePosition(
    from,
    sync.type,
    sync.binding.mapping,
  );
  const end = absolutePositionToRelativePosition(
    to,
    sync.type,
    sync.binding.mapping,
  );

  const quote = editor.state.doc
    .textBetween(from, to, ' ')
    .trim()
    .slice(0, MAX_COMMENT_ANCHOR_QUOTE_LENGTH);

  if (!quote) return null;

  return {
    start: encodeBase64(Y.encodeRelativePosition(start)),
    end: encodeBase64(Y.encodeRelativePosition(end)),
    quote,
  };
};

// Обратный путь. `null` — нормальный исход: удалённый фрагмент или чужой
// документ не должны ломать панель, комментарий остаётся в списке.
export const resolveCommentAnchor = (
  editor: Editor,
  anchor: CommentAnchorDto,
): { from: number; to: number } | null => {
  const sync = ySyncPluginKey.getState(editor.state);

  if (!sync) return null;

  const startBytes = decodeBase64(anchor.start);
  const endBytes = decodeBase64(anchor.end);

  if (!startBytes || !endBytes) return null;

  try {
    const from = relativePositionToAbsolutePosition(
      sync.doc,
      sync.type,
      Y.decodeRelativePosition(startBytes),
      sync.binding.mapping,
    );
    const to = relativePositionToAbsolutePosition(
      sync.doc,
      sync.type,
      Y.decodeRelativePosition(endBytes),
      sync.binding.mapping,
    );

    const size = editor.state.doc.content.size;

    if (from === null || to === null) return null;
    if (from < 0 || to > size || to <= from) return null;

    return { from, to };
  } catch {
    return null;
  }
};

export const commentHighlightKey = new PluginKey<DecorationSet>(
  'commentHighlight',
);

// Подсветка живёт декорациями, а не разметкой документа: это состояние
// интерфейса, а не содержимое, и оно не должно попадать в Yjs.
export const CommentHighlight = Extension.create({
  name: 'commentHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: commentHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (transaction, previous) => {
            const next = transaction.getMeta(commentHighlightKey) as
              | DecorationSet
              | undefined;

            if (next) return next;

            return previous.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations(state) {
            return commentHighlightKey.getState(state) ?? null;
          },
        },
      }),
    ];
  },
});

export const setCommentHighlights = (
  editor: Editor,
  ranges: CommentRange[],
  activeCommentId: string | null,
): void => {
  const decorations = ranges.flatMap((range) =>
    range.from < range.to
      ? [
          Decoration.inline(range.from, range.to, {
            class:
              range.commentId === activeCommentId
                ? 'comment-anchor comment-anchor-active'
                : 'comment-anchor',
          }),
        ]
      : [],
  );

  editor.view.dispatch(
    editor.state.tr.setMeta(
      commentHighlightKey,
      DecorationSet.create(editor.state.doc, decorations),
    ),
  );
};

// Прокрутка к фрагменту: выделяем диапазон и отдаём скролл браузеру.
export const scrollToCommentAnchor = (
  editor: Editor,
  anchor: CommentAnchorDto,
): boolean => {
  const range = resolveCommentAnchor(editor, anchor);

  if (!range) return false;

  editor.chain().focus().setTextSelection(range).scrollIntoView().run();

  return true;
};
