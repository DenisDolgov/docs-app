import { clearTimeout } from 'node:timers';
import { encoding } from 'lib0';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

import {
  COLLAB_FLUSH_INTERVAL,
  COLLAB_HYDRATION_ORIGIN,
  COLLAB_MESSAGE_SYNC,
} from './collab.constants';
import { CollabConnection } from './collab.models';
import { encodeAwarenessMessage } from './collab.protocol';
import { CollabRepository } from './collab.repository';

interface AwarenessUpdate {
  added: number[];
  updated: number[];
  removed: number[];
}

export class CollabRoom {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  // Чей clientID за каким соединением закреплён (защита от подделки присутствия).
  private readonly clientOwners = new Map<number, CollabConnection>();

  private readonly connections = new Set<CollabConnection>();
  private pending: Uint8Array[] = [];
  private flushTimer?: NodeJS.Timeout;
  private disposed = false;

  constructor(
    readonly documentId: string,
    private readonly repository: CollabRepository,
  ) {
    // сервер не участник: пустое локальное состояние Awareness() иначе
    // попадало бы в getStates() и рассылалось клиентам от имени сервера
    this.awareness.setLocalState(null);
    this.awareness.on('update', this.onAwarenessUpdate.bind(this));
  }

  async hydrate(): Promise<void> {
    const [snapshot, updates] = await Promise.all([
      this.repository.loadSnapshot(this.documentId),
      this.repository.listUpdates(this.documentId),
    ]);

    if (snapshot) {
      Y.applyUpdate(
        this.doc,
        new Uint8Array(snapshot),
        COLLAB_HYDRATION_ORIGIN,
      );
    }

    for (const update of updates) {
      Y.applyUpdate(this.doc, new Uint8Array(update), COLLAB_HYDRATION_ORIGIN);
    }

    this.doc.on('update', this.onDocUpdate.bind(this));
  }

  // любое изменение doc: local-правка пользователя или применённый remote-апдейт
  private onDocUpdate(update: Uint8Array, origin: unknown) {
    if (origin === COLLAB_HYDRATION_ORIGIN) return;

    this.broadcast(update, origin);
    this.queue(update);
  }

  // origin — соединение, принёсшее правку, либо null (локальное удаление при detach)
  private onAwarenessUpdate(
    { added, updated, removed }: AwarenessUpdate,
    origin: unknown,
  ) {
    const changed = [...added, ...updated, ...removed];

    if (changed.length === 0) return;

    if (this.connections.has(origin as CollabConnection)) {
      this.trackOwnership(origin as CollabConnection, added, removed);
    }

    // state удалённых clientID кодируется как null — клиент трактует это как выход
    const message = encodeAwarenessMessage(this.awareness, changed);
    for (const conn of this.connections) {
      if (conn !== origin) conn.send(message);
    }
  }

  // отмечаем, какие clientID принесло соединение; на detach по ним снимем presence
  private trackOwnership(
    connection: CollabConnection,
    added: number[],
    removed: number[],
  ) {
    for (const clientId of added) {
      this.clientOwners.set(clientId, connection);
    }

    for (const clientId of removed) {
      if (this.clientOwners.get(clientId) === connection) {
        this.clientOwners.delete(clientId);
      }
    }
  }

  private broadcast(update: Uint8Array, origin: unknown) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, COLLAB_MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const conn of this.connections) {
      if (conn !== origin) conn.send(message);
    }
  }

  attach(connection: CollabConnection) {
    this.connections.add(connection);
  }

  // Чужой clientID менять/удалять нельзя: закрепив clientID за соединением, мы не
  // даём другому соединению подделать или снять это присутствие.
  ownsClientId(connection: CollabConnection, clientId: number): boolean {
    const owner = this.clientOwners.get(clientId);

    return owner === undefined || owner === connection;
  }

  detach(connection: CollabConnection) {
    this.connections.delete(connection);

    const owned: number[] = [];
    for (const [clientId, owner] of this.clientOwners) {
      if (owner === connection) owned.push(clientId);
    }

    if (owned.length === 0) return;

    for (const clientId of owned) this.clientOwners.delete(clientId);

    // removeAwarenessStates эмитит update(origin=null) → onAwarenessUpdate разошлёт выход остальным
    awarenessProtocol.removeAwarenessStates(this.awareness, owned, null);
  }

  get isEmpty(): boolean {
    return this.connections.size === 0;
  }

  private queue(update: Uint8Array): void {
    this.pending.push(update);

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(
        () => void this.flush(),
        COLLAB_FLUSH_INTERVAL,
      );
      this.flushTimer?.unref();
    }
  }

  private flushChain: Promise<void> = Promise.resolve();

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    if (this.pending.length === 0) return;

    const batch = this.pending;
    this.pending = [];

    const run = this.flushChain.then(() =>
      this.repository.appendUpdates(this.documentId, batch),
    );
    this.flushChain = run.catch(() => undefined);

    try {
      await run;
    } catch (error) {
      // апдейты не потеряны: вернём их в очередь и повторим на следующем flush
      this.pending.unshift(...batch);
      throw error;
    }

    return this.flushChain;
  }

  async compact(): Promise<void> {
    await this.flush();

    // граница — последний записанный апдейт: до него удаляем после снэпшота
    const boundary = await this.repository.getLastUpdate(this.documentId);

    if (!boundary) return;

    // TODO: между flush и encodeStateAsUpdate может прийти новый апдейт —
    // снэпшот и содержимое document_updates на этот момент не гарантированно равны
    const snapshot = Y.encodeStateAsUpdate(this.doc);

    await this.repository.compact(this.documentId, snapshot, boundary.id);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    try {
      await this.compact();
    } finally {
      this.connections.clear();
      this.doc.destroy();
    }
  }
}
