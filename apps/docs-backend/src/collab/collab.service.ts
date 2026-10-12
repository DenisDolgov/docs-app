import { Injectable } from '@nestjs/common';
import { encoding } from 'lib0';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

import { COLLAB_MESSAGE_SYNC } from './collab.constants';
import { CollabConnection } from './collab.models';

class CollabRoom {
  readonly doc = new Y.Doc();
  readonly connections = new Set<CollabConnection>();

  constructor(readonly documentId: string) {
    this.doc.on('update', (update, origin) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, COLLAB_MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      for (const conn of this.connections) {
        if (conn !== origin) conn.send(message);
      }
    });
  }
}

@Injectable()
export class CollabService {
  private readonly rooms = new Map<string, CollabRoom>();

  public getRoom(documentId: string) {
    return this.rooms.get(documentId) ?? this.createRoom(documentId);
  }

  private createRoom(documentId: string) {
    const room = new CollabRoom(documentId);

    this.rooms.set(documentId, room);

    return room;
  }
}
