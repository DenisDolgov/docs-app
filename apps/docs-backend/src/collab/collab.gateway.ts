import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';

import { COLLAB_WS_PATH } from './collab.constants';
import { CollabConnection } from './collab.models';
import { applySyncMessage, encodeSyncStep1 } from './collab.protocol';
import { CollabService } from './collab.service';

@WebSocketGateway({ path: COLLAB_WS_PATH })
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly collabService: CollabService) {}

  handleConnection(client: CollabConnection, request: { url?: string }) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const documentId = url.searchParams.get('documentId') ?? '';
    client.documentId = documentId;

    const room = this.collabService.getRoom(documentId);
    room.connections.add(client);

    client.on('message', (data: Buffer) => {
      const bytes = new Uint8Array(data);
      const reply = applySyncMessage(room.doc, bytes, client);

      if (reply) client.send(reply);
    });

    client.send(encodeSyncStep1(room.doc));
  }

  handleDisconnect(client: CollabConnection) {
    const room = this.collabService.getRoom(client.documentId ?? '');
    room.connections.delete(client);
  }
}
