import {
  COLLAB_MESSAGE_AWARENESS,
  COLLAB_MESSAGE_SYNC,
} from '@docs-app/contracts/collab/protocol';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import type * as Y from 'yjs';

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

  // ответ генерится только на SyncStep1; пустой ответ = остался один байт типа
  if (encoding.length(encoder) <= 1) return null;

  return encoding.toUint8Array(encoder);
};

export const readMessageType = (data: Uint8Array): number => {
  const decoder = decoding.createDecoder(data);

  return decoding.readVarUint(decoder);
};

export interface AwarenessMessage {
  clientIds: number[];
  // payload без префикса типа — его ждёт applyAwarenessUpdate
  payload: Uint8Array;
}

// Разбор awareness-кадра: [type][varUint8Array(payload)],
// payload = [len][{clientID, clock, JSON state}...].
// clientIds вынимаем заранее — нужны для проверки права владения до применения.
export const readAwarenessMessage = (
  data: Uint8Array,
): AwarenessMessage | null => {
  const frameDecoder = decoding.createDecoder(data);

  if (decoding.readVarUint(frameDecoder) !== COLLAB_MESSAGE_AWARENESS) {
    return null;
  }

  const payload = decoding.readVarUint8Array(frameDecoder);
  const payloadDecoder = decoding.createDecoder(payload);
  const count = decoding.readVarUint(payloadDecoder);
  const clientIds: number[] = [];

  for (let i = 0; i < count; i++) {
    clientIds.push(decoding.readVarUint(payloadDecoder));
    decoding.readVarUint(payloadDecoder); // clock
    decoding.readVarString(payloadDecoder); // JSON state
  }

  return { clientIds, payload };
};

export const encodeAwarenessMessage = (
  awareness: awarenessProtocol.Awareness,
  clientIds: number[],
) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, COLLAB_MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds),
  );

  return encoding.toUint8Array(encoder);
};

export const applyAwarenessMessage = (
  awareness: awarenessProtocol.Awareness,
  message: AwarenessMessage,
  origin: unknown,
) => {
  awarenessProtocol.applyAwarenessUpdate(awareness, message.payload, origin);
};
