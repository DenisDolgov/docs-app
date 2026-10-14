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

  async handleConnection(
    client: CollabConnection,
    request: { url?: string },
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const documentId = url.searchParams.get('documentId');

      if (!documentId) {
        client.close(4000, 'Document ID is required');
        return;
      }

      client.documentId = documentId;
      const room = await this.collabService.attach(client);

      client.on('message', (data: Buffer) => {
        const bytes = new Uint8Array(data);
        const reply = applySyncMessage(room.doc, bytes, client);

        if (reply) client.send(reply);
      });

      client.send(encodeSyncStep1(room.doc));
    } catch {
      client.close(1011, 'Connection setup failed');
    }
  }

  async handleDisconnect(client: CollabConnection) {
    await this.collabService.detach(client);
  }
}
