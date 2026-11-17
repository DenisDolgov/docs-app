import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  type CommentAnchor,
  InvalidCommentAnchorError,
  normalizeCommentAnchor,
} from '../../src/comment/comment-anchor';

// Падающие тесты куска S22: контракт нормализации якоря. Фикстуры строятся
// настоящим Yjs, а не строкой-заглушкой.
const positionFixture = () => {
  const doc = new Y.Doc();
  const text = doc.getText('fixture');
  text.insert(0, 'фрагмент текста');

  return {
    start: Y.encodeRelativePosition(
      Y.createRelativePositionFromTypeIndex(text, 0),
    ),
    end: Y.encodeRelativePosition(
      Y.createRelativePositionFromTypeIndex(text, 8),
    ),
  };
};

const toBase64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');

const fromBase64 = (value: string): Uint8Array =>
  new Uint8Array(Buffer.from(value, 'base64'));

const input = (overrides: Partial<CommentAnchor> = {}) => {
  const fixture = positionFixture();

  return {
    start: toBase64(fixture.start),
    end: toBase64(fixture.end),
    quote: 'фрагмент',
    ...overrides,
  };
};

describe('normalizeCommentAnchor', () => {
  it('возвращает якорь для хранения в jsonb', () => {
    const value = input();
    const anchor = normalizeCommentAnchor(value);

    expect(anchor).toEqual(value);
    expect(Y.decodeRelativePosition(fromBase64(anchor.start))).toBeDefined();
    expect(Y.decodeRelativePosition(fromBase64(anchor.end))).toBeDefined();
  });

  it('обрезает запасной текст по краям', () => {
    const anchor = normalizeCommentAnchor(input({ quote: '  фрагмент  ' }));

    expect(anchor.quote).toBe('фрагмент');
  });

  it('приводит base64 к каноническому виду', () => {
    const fixture = positionFixture();
    const canonical = toBase64(fixture.start);

    const anchor = normalizeCommentAnchor(
      input({ start: canonical.replace(/=+$/, '') }),
    );

    expect(anchor.start).toBe(canonical);
  });

  it('не переносит лишние поля клиента в jsonb', () => {
    const anchor = normalizeCommentAnchor({
      ...input(),
      color: 'red',
    } as CommentAnchor & { color: string });

    expect(Object.keys(anchor).sort()).toEqual(['end', 'quote', 'start']);
  });

  it('отклоняет строку, которая не является base64', () => {
    expect(() =>
      normalizeCommentAnchor(input({ start: 'не base64?' })),
    ).toThrow(InvalidCommentAnchorError);
  });

  it('отклоняет base64, который не декодируется в relative position', () => {
    expect(() =>
      normalizeCommentAnchor(
        input({ start: toBase64(new Uint8Array([1, 2, 3])) }),
      ),
    ).toThrow(InvalidCommentAnchorError);
  });

  it('отклоняет пустой запасной текст', () => {
    expect(() => normalizeCommentAnchor(input({ quote: '   ' }))).toThrow(
      InvalidCommentAnchorError,
    );
  });

  it('отклоняет слишком длинный запасной текст', () => {
    expect(() =>
      normalizeCommentAnchor(input({ quote: 'a'.repeat(501) })),
    ).toThrow(InvalidCommentAnchorError);
  });
});
