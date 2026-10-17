import {
  type AwarenessChanges,
  COLLAB_CLOSE_ACCESS_DENIED,
  COLLAB_CLOSE_DOCUMENT_ID_REQUIRED,
  COLLAB_CLOSE_FORBIDDEN_ORIGIN,
  COLLAB_CLOSE_UNAUTHORIZED,
  COLLAB_DOCUMENT_QUERY_PARAM,
  COLLAB_MESSAGE_AWARENESS,
  COLLAB_MESSAGE_SYNC,
  COLLAB_WS_PATH,
} from '@docs-app/contracts/collab/protocol';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

// Протокол — единый источник в `@docs-app/contracts/collab/protocol`.
const MESSAGE_SYNC = COLLAB_MESSAGE_SYNC;
const MESSAGE_AWARENESS = COLLAB_MESSAGE_AWARENESS;
const REMOTE_ORIGIN = 'remote';

// Коды отказа на рукопожатии (значения — из контракта).
const CLOSE_REASONS: Record<number, string> = {
  [COLLAB_CLOSE_DOCUMENT_ID_REQUIRED]: 'Неизвестный документ',
  [COLLAB_CLOSE_UNAUTHORIZED]: 'Сессия истекла',
  [COLLAB_CLOSE_ACCESS_DENIED]: 'Нет доступа',
  [COLLAB_CLOSE_FORBIDDEN_ORIGIN]: 'Нет доступа',
};

const SESSION_EXPIRED_CODE = COLLAB_CLOSE_UNAUTHORIZED;

const MAX_RECONNECT_DELAY = 15000;

export type CollabStatus = 'connecting' | 'connected' | 'closed';

export interface CollabCloseInfo {
  code: number;
  message: string;
}

interface CollabProviderOptions {
  documentId: string;
  url: string;
  // Убедиться, что access-кука свежая (дёрнуть refresh под локом), перед
  // переподключением после отклонённого хендшейка.
  refreshSession?: () => Promise<void>;
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

    const url = new URL(COLLAB_WS_PATH, this.options.url);
    url.searchParams.set(COLLAB_DOCUMENT_QUERY_PARAM, this.options.documentId);

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
    // `y-protocols` не экспортирует тип наблюдателя — держим его в контракте.
    changes: AwarenessChanges,
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

    // Хендшейк отклонён по авторизации: возможно, access-кука протухла —
    // обновляем сессию и переподключаемся.
    if (event.code === SESSION_EXPIRED_CODE) {
      void this.handleUnauthorized();
      return;
    }

    const reason = CLOSE_REASONS[event.code];

    if (reason) {
      this.options.onStatusChange?.('closed');
      this.options.onClose?.({ code: event.code, message: reason });
      return;
    }

    this.scheduleReconnect();
  };

  private scheduleReconnect = () => {
    // Ограниченный ретрай с экспоненциальным backoff.
    this.options.onStatusChange?.('connecting');
    const delay = Math.min(
      1000 * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  };

  private handleUnauthorized = async () => {
    const refuse = () => {
      this.options.onStatusChange?.('closed');
      this.options.onClose?.({
        code: SESSION_EXPIRED_CODE,
        message: CLOSE_REASONS[SESSION_EXPIRED_CODE],
      });
    };

    if (!this.options.refreshSession) {
      refuse();
      return;
    }

    this.options.onStatusChange?.('connecting');

    try {
      await this.options.refreshSession();
    } catch {
      refuse();
      return;
    }

    if (this.destroyed) return;

    this.scheduleReconnect();
  };
}
