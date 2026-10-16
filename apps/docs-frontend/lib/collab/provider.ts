import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

// Протокол совпадает с бэкендом (`collab.protocol.ts`).
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const REMOTE_ORIGIN = 'remote';

// Коды отказа на рукопожатии
const CLOSE_REASONS: Record<number, string> = {
  4000: 'Неизвестный документ',
  4001: 'Сессия истекла',
  4003: 'Нет доступа',
};

const MAX_RECONNECT_DELAY = 15000;

export type CollabStatus = 'connecting' | 'connected' | 'closed';

export interface CollabCloseInfo {
  code: number;
  message: string;
}

interface CollabProviderOptions {
  documentId: string;
  token: string;
  url: string;
  onStatusChange?: (status: CollabStatus) => void;
  onClose?: (info: CollabCloseInfo) => void;
}

// Клиентский провайдер нашего Yjs-сервера: три объекта (WebSocket, Y.Doc,
// Awareness) и две подписки, кадры — [varUint(тип)][payload].
export class CollabProvider {
  public readonly doc = new Y.Doc();
  public readonly awareness = new Awareness(this.doc);

  private socket: WebSocket | null = null;
  private destroyed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: CollabProviderOptions) {
    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
    this.connect();
  }

  public destroy() {
    this.destroyed = true;

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);

    this.socket?.close();
    this.socket = null;

    this.awareness.destroy();
    this.doc.destroy();
  }

  private connect() {
    if (this.destroyed) return;

    this.options.onStatusChange?.('connecting');

    const url = new URL('/ws', this.options.url);
    url.searchParams.set('documentId', this.options.documentId);
    url.searchParams.set('token', this.options.token);

    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    socket.onopen = this.handleOpen;
    socket.onmessage = this.handleMessage;
    socket.onclose = this.handleClose;
    socket.onerror = () => socket.close();

    this.socket = socket;
  }

  private send(payload: Uint8Array) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload);
    }
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this.send(encoding.toUint8Array(encoder));
  };

  private handleAwarenessUpdate = (
    // fixMe дублируем тип на бэкенде, перенести в общую библиотеку
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === REMOTE_ORIGIN) return;

    const changedClients = changes.added
      .concat(changes.updated)
      .concat(changes.removed);

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      encodeAwarenessUpdate(this.awareness, changedClients),
    );
    this.send(encoding.toUint8Array(encoder));
  };

  private handleOpen = () => {
    this.reconnectAttempts = 0;
    this.options.onStatusChange?.('connected');

    const syncEncoder = encoding.createEncoder();
    encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(syncEncoder, this.doc);
    this.send(encoding.toUint8Array(syncEncoder));

    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      encodeAwarenessUpdate(this.awareness, [this.doc.clientID]),
    );
    this.send(encoding.toUint8Array(awarenessEncoder));
  };

  private handleMessage = (event: MessageEvent) => {
    const data = new Uint8Array(event.data as ArrayBuffer);
    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, this.doc, REMOTE_ORIGIN);

      // ответ генерится только на SyncStep1; пустой — остался один байт типа
      if (encoding.length(encoder) > 1) {
        this.send(encoding.toUint8Array(encoder));
      }
    } else if (messageType === MESSAGE_AWARENESS) {
      applyAwarenessUpdate(
        this.awareness,
        decoding.readVarUint8Array(decoder),
        REMOTE_ORIGIN,
      );
    }
  };

  private handleClose = (event: CloseEvent) => {
    this.socket = null;
    if (this.destroyed) return;

    const reason = CLOSE_REASONS[event.code];

    if (reason) {
      this.options.onStatusChange?.('closed');
      this.options.onClose?.({ code: event.code, message: reason });
      return;
    }

    // Сетевой сбой — ограниченный ретрай с экспоненциальным backoff.
    this.options.onStatusChange?.('connecting');
    const delay = Math.min(
      1000 * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  };
}
