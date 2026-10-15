import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import WS from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

// Номера типов кадра берём из спецификации y-protocols, а не из серверных
// констант: это внешний клиент, он знает только проводной формат
// (0 — sync, 1 — awareness). Так же устроен референсный y-websocket.
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export interface CollabClient {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  readonly socket: WS;
  readonly opened: Promise<void>;
  readonly closed: Promise<{ code: number; reason: string }>;
  close(): void;
}

// Минимальный клиент протокола Yjs: рукопожатие sync, обмен апдейтами и
// awareness. Собран напрямую из lib0 + y-protocols (а не из серверных
// хелперов), чтобы проверять реальный проводной формат, а не зеркало
// реализации. Токен передаётся в query-строке, как это делает y-websocket.
export const openCollabClient = (
  baseUrl: string,
  documentId: string,
  token?: string,
): CollabClient => {
  const url = new URL(`${baseUrl}/ws`);
  url.searchParams.set('documentId', documentId);
  if (token) url.searchParams.set('token', token);

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  const socket = new WS(url.toString());

  const send = (frame: Uint8Array) => {
    if (socket.readyState === WS.OPEN) socket.send(frame);
  };

  const sendAwareness = (clientIds: number[]) => {
    if (clientIds.length === 0) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds),
    );
    send(encoding.toUint8Array(encoder));
  };

  doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    send(encoding.toUint8Array(encoder));
  });

  awareness.on(
    'update',
    (
      changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === 'remote') return;

      sendAwareness([...changes.added, ...changes.updated, ...changes.removed]);
    },
  );

  // `opened` считаем наступившим, когда сервер прислал первый кадр: сервер в
  // `handleConnection` сначала вешает обработчик `message`, а лишь затем шлёт
  // SyncStep1. Так тест не вставит текст раньше, чем сервер готов его принять.
  let markOpened = () => {};
  const opened = new Promise<void>((resolve) => {
    markOpened = resolve;
  });

  // Своё присутствие публикуем на первом серверном кадре, а не в `open`: так мы
  // гарантированно попадаем в уже навешенный обработчик сервера (кадры, пришедшие
  // до `client.on('message')`, теряются).
  let announced = false;

  socket.on('message', (raw: Buffer) => {
    const decoder = decoding.createDecoder(new Uint8Array(raw));
    const encoder = encoding.createEncoder();
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, doc, 'remote');
      if (encoding.length(encoder) > 1) send(encoding.toUint8Array(encoder));
    } else if (messageType === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        'remote',
      );
    }

    if (!announced && awareness.getLocalState() !== null) {
      announced = true;
      sendAwareness([doc.clientID]);
    }

    markOpened();
  });

  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    socket.on('close', (code: number, reason: Buffer) =>
      resolve({ code, reason: reason.toString() }),
    );
    socket.on('error', () => resolve({ code: -1, reason: 'socket error' }));
  });

  // Если соединение отклонено, `opened` не наступит — разрешаем его на закрытии,
  // чтобы `await client.opened` не подвесил тест.
  closed.then(() => markOpened());

  return {
    doc,
    awareness,
    socket,
    opened,
    closed,
    close: () => {
      socket.close();
    },
  };
};
