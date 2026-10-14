import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WS from 'ws';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

import { COLLAB_MESSAGE_SYNC } from '../../src/collab/collab.constants';
import { createTestApp } from '../utils';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nextDocumentId = () => randomUUID();

describe('collab gateway (e2e)', () => {
  let app: INestApplication;
  let port: number;
  const sockets: WS[] = [];

  const connect = async (documentId: string): Promise<Y.Doc> => {
    const doc = new Y.Doc();
    const ws = new WS(`ws://127.0.0.1:${port}/ws?documentId=${documentId}`);
    sockets.push(ws);

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, COLLAB_MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      if (ws.readyState === WS.OPEN) ws.send(encoding.toUint8Array(encoder));
    });

    ws.on('message', (raw: Buffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(raw));
      const encoder = encoding.createEncoder();
      const type = decoding.readVarUint(decoder);
      if (type === COLLAB_MESSAGE_SYNC) {
        encoding.writeVarUint(encoder, COLLAB_MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, doc, 'remote');
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }
      }
    });

    await new Promise<void>((resolve) => ws.on('open', () => resolve()));
    await wait(150);
    return doc;
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.close();
    await app.close();
  });

  it('два клиента в одной комнате сходятся к одному тексту', async () => {
    const documentId = nextDocumentId();
    const a = await connect(documentId);
    const b = await connect(documentId);

    a.getText('content').insert(0, 'Hello');
    await wait(300);
    expect(b.getText('content').toString()).toBe('Hello');

    b.getText('content').insert(5, ' World');
    await wait(300);
    expect(a.getText('content').toString()).toBe('Hello World');
    expect(b.getText('content').toString()).toBe('Hello World');
  });

  it('комнаты изолированы по documentId', async () => {
    const a = await connect(nextDocumentId());
    const b = await connect(nextDocumentId());

    a.getText('content').insert(0, 'private');
    await wait(300);

    expect(b.getText('content').toString()).toBe('');
  });
});
