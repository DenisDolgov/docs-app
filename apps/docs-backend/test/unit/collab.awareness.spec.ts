import * as encoding from 'lib0/encoding';
import { describe, expect, it } from 'vitest';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

import {
  COLLAB_MESSAGE_AWARENESS,
  COLLAB_MESSAGE_SYNC,
} from '../../src/collab/collab.constants';
import {
  applyAwarenessMessage,
  applySyncMessage,
  encodeAwarenessMessage,
  readAwarenessMessage,
  readMessageType,
} from '../../src/collab/collab.protocol';

const newAwareness = () => new awarenessProtocol.Awareness(new Y.Doc());

const apply = (
  viewer: awarenessProtocol.Awareness,
  frame: Uint8Array,
  origin: unknown,
) => {
  const message = readAwarenessMessage(frame);
  if (!message) throw new Error('не awareness-кадр');

  return applyAwarenessMessage(viewer, message, origin);
};

describe('collab awareness protocol (unit)', () => {
  it('различает sync- и awareness-кадры по первому полю', () => {
    const awareness = newAwareness();

    const syncFrame = new Uint8Array([COLLAB_MESSAGE_SYNC, 0]);
    const awarenessFrame = encodeAwarenessMessage(awareness, []);

    expect(readMessageType(syncFrame)).toBe(COLLAB_MESSAGE_SYNC);
    expect(readMessageType(awarenessFrame)).toBe(COLLAB_MESSAGE_AWARENESS);
  });

  it('переносит локальное состояние клиента в другой Awareness', () => {
    const author = newAwareness();
    author.setLocalStateField('user', { name: 'Alice' });

    const viewer = newAwareness();
    apply(viewer, encodeAwarenessMessage(author, [author.clientID]), 'remote');

    expect(viewer.getStates().get(author.clientID)).toEqual({
      user: { name: 'Alice' },
    });
  });

  it('переносит выход: null-состояние убирает клиента у наблюдателя', () => {
    const author = newAwareness();
    author.setLocalStateField('user', { name: 'Alice' });

    const viewer = newAwareness();
    apply(viewer, encodeAwarenessMessage(author, [author.clientID]), 'remote');
    expect(viewer.getStates().has(author.clientID)).toBe(true);

    author.setLocalState(null);
    apply(viewer, encodeAwarenessMessage(author, [author.clientID]), 'remote');

    expect(viewer.getStates().has(author.clientID)).toBe(false);
  });

  it('разбирает список clientID из кадра', () => {
    const author = newAwareness();
    author.setLocalStateField('user', { name: 'Alice' });

    const frame = encodeAwarenessMessage(author, [author.clientID]);
    const message = readAwarenessMessage(frame);

    expect(message?.clientIds).toEqual([author.clientID]);
  });

  it('не разбирает sync-кадр как awareness', () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, COLLAB_MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, Y.encodeStateAsUpdate(new Y.Doc()));

    expect(readAwarenessMessage(encoding.toUint8Array(encoder))).toBeNull();
  });

  it('sync-путь игнорирует awareness-кадр', () => {
    const awareness = newAwareness();

    expect(
      applySyncMessage(
        new Y.Doc(),
        encodeAwarenessMessage(awareness, []),
        null,
      ),
    ).toBeNull();
  });
});
