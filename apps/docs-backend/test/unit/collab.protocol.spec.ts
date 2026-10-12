import * as encoding from 'lib0/encoding';
import { describe, expect, it } from 'vitest';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

import { COLLAB_MESSAGE_SYNC } from '../../src/collab/collab.constants';
import {
  applySyncMessage,
  encodeSyncStep1,
} from '../../src/collab/collab.protocol';

const encodeUpdate = (update: Uint8Array): Uint8Array => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, COLLAB_MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
};

describe('collab protocol (unit)', () => {
  it('на SyncStep1 отвечает SyncStep2 с состоянием документа', () => {
    const serverDoc = new Y.Doc();
    serverDoc.getText('content').insert(0, 'Hello');

    const remoteDoc = new Y.Doc();
    const step1 = encodeSyncStep1(remoteDoc);

    const reply = applySyncMessage(serverDoc, step1, 'remote');
    expect(reply).not.toBeNull();

    applySyncMessage(remoteDoc, reply as Uint8Array, 'remote');
    expect(remoteDoc.getText('content').toString()).toBe('Hello');
  });

  it('применяет Update и не отвечает на него', () => {
    const serverDoc = new Y.Doc();
    const clientDoc = new Y.Doc();
    clientDoc.getText('content').insert(0, 'Hi');

    const reply = applySyncMessage(
      serverDoc,
      encodeUpdate(Y.encodeStateAsUpdate(clientDoc)),
      'remote',
    );

    expect(reply).toBeNull();
    expect(serverDoc.getText('content').toString()).toBe('Hi');
  });

  it('идемпотентен: повторный Update не меняет документ дважды', () => {
    const serverDoc = new Y.Doc();
    const clientDoc = new Y.Doc();
    clientDoc.getText('content').insert(0, 'Hi');

    const update = encodeUpdate(Y.encodeStateAsUpdate(clientDoc));
    applySyncMessage(serverDoc, update, 'remote');
    applySyncMessage(serverDoc, update, 'remote');

    expect(serverDoc.getText('content').toString()).toBe('Hi');
  });
});
