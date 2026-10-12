import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import type * as Y from 'yjs';

import { COLLAB_MESSAGE_SYNC } from './collab.constants';

export const encodeSyncStep1 = (doc: Y.Doc): Uint8Array => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, COLLAB_MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);

  return encoding.toUint8Array(encoder);
};

export const applySyncMessage = (
  doc: Y.Doc,
  data: Uint8Array,
  origin: unknown,
): Uint8Array | null => {
  const decoder = decoding.createDecoder(data);
  const encoder = encoding.createEncoder();
  const messageType = decoding.readVarUint(decoder);

  if (messageType !== COLLAB_MESSAGE_SYNC) return null;

  encoding.writeVarUint(encoder, COLLAB_MESSAGE_SYNC);
  syncProtocol.readSyncMessage(decoder, encoder, doc, origin);

  if (encoding.length(encoder) <= 1) return null;

  return encoding.toUint8Array(encoder);
};
