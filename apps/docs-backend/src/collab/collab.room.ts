import { clearTimeout } from 'node:timers';
import { encoding } from 'lib0';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

import {
  COLLAB_FLUSH_INTERVAL,
  COLLAB_HYDRATION_ORIGIN,
  COLLAB_MESSAGE_SYNC,
} from './collab.constants';
import { CollabConnection } from './collab.models';
import { CollabRepository } from './collab.repository';

export class CollabRoom {
  readonly doc = new Y.Doc();

  private readonly connections = new Set<CollabConnection>();
  private pending: Uint8Array[] = [];
  private flushTimer?: NodeJS.Timeout;
  private disposed = false;

  constructor(
    readonly documentId: string,
    private readonly repository: CollabRepository,
  ) {}

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

    this.doc.on('update', this.onLocalUpdate.bind(this));
  }

  private onLocalUpdate(update: Uint8Array, origin: unknown) {
    if (origin === COLLAB_HYDRATION_ORIGIN) return;

    this.broadcast(update, origin);
    this.queue(update);
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

  detach(connection: CollabConnection) {
    this.connections.delete(connection);
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
      this.pending.unshift(...batch);
      throw error;
    }

    return this.flushChain;
  }

  async compact(): Promise<void> {
    await this.flush();

    const boundary = await this.repository.getLastUpdate(this.documentId);

    if (!boundary) return;

    const snapshot = Y.encodeStateAsUpdate(this.doc);

    await this.repository.compact(this.documentId, snapshot, boundary.id);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    try {
      await this.flush();
      await this.compact();
    } finally {
      this.connections.clear();
      this.doc.destroy();
    }
  }
}
