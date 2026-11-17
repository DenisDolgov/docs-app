import { MAX_COMMENT_ANCHOR_QUOTE_LENGTH } from '@docs-app/contracts/comment/limits';
import * as Y from 'yjs';

// Якорь комментария: два конца выделения как Yjs relative position в base64
// плюс запасной текст фрагмента. Одна форма и на входе, и в `comments.anchor`:
// после нормализации клиентские поля отсекаются, а сервер хранит эту форму в
// `jsonb` — проверить позицию без живого документа он не может.
export interface CommentAnchor {
  start: string;
  end: string;
  quote: string;
}

// Отдельная ошибка, чтобы сервис отличал мусорный якорь (400) от сбоя.
export class InvalidCommentAnchorError extends Error {
  constructor(message = 'Invalid comment anchor') {
    super(message);
    this.name = 'InvalidCommentAnchorError';
  }
}

// `atob` бросает на символах вне base64-алфавита и терпит потерянный хвост
// `=`, а `Buffer` возвращает каноническую форму — её и кладём в `jsonb`.
const decodeBase64 = (value: string): Buffer => {
  try {
    return Buffer.from(atob(value), 'latin1');
  } catch {
    throw new InvalidCommentAnchorError();
  }
};

export const normalizeCommentAnchor = (input: CommentAnchor): CommentAnchor => {
  const quote = input.quote.trim();

  if (!quote) throw new InvalidCommentAnchorError();
  if (quote.length > MAX_COMMENT_ANCHOR_QUOTE_LENGTH)
    throw new InvalidCommentAnchorError();

  const startBuffer = decodeBase64(input.start);
  const endBuffer = decodeBase64(input.end);

  try {
    Y.decodeRelativePosition(startBuffer);
    Y.decodeRelativePosition(endBuffer);
  } catch {
    throw new InvalidCommentAnchorError();
  }

  return {
    start: startBuffer.toString('base64'),
    end: endBuffer.toString('base64'),
    quote,
  };
};
