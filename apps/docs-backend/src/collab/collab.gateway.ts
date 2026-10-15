import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';

import { AccessTokenPayload } from '../auth/auth.models';
import { COLLAB_MESSAGE_AWARENESS, COLLAB_WS_PATH } from './collab.constants';
import { CollabConnection } from './collab.models';
import {
  applyAwarenessMessage,
  applySyncMessage,
  encodeAwarenessMessage,
  encodeSyncStep1,
  readAwarenessMessage,
  readMessageType,
} from './collab.protocol';
import { CollabService } from './collab.service';
import { CollabAccessService } from './collab-access.service';

@WebSocketGateway({ path: COLLAB_WS_PATH })
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly collabService: CollabService,
    private readonly collabAccessService: CollabAccessService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(
    client: CollabConnection,
    request: { url?: string },
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const documentId = url.searchParams.get('documentId');
      const token = url.searchParams.get('token');

      if (!documentId) {
        return client.close(4000, 'Document ID is required');
      }

      if (!token) {
        return client.close(4001, 'Unauthorized');
      }

      let user: AccessTokenPayload;

      try {
        user = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      } catch {
        return client.close(4001, 'Unauthorized');
      }

      try {
        const access = await this.collabAccessService.resolveAccess({
          documentId,
          userId: user.sub,
        });

        // нет доступа и нет документа отвечают одинаково — чтобы не раскрывать существование чужого документа
        if (!access) {
          return client.close(4003, 'Document not found');
        }
      } catch {
        return client.close(4003, 'Document not found');
      }

      client.documentId = documentId;
      const room = await this.collabService.attach(client);

      client.on('message', (data: Buffer) => {
        try {
          const bytes = new Uint8Array(data);

          if (readMessageType(bytes) === COLLAB_MESSAGE_AWARENESS) {
            const message = readAwarenessMessage(bytes);
            // clientID в кадре должен принадлежать этому соединению (защита от спуфинга)
            const ownedByClient = message?.clientIds.every((clientId) =>
              room.ownsClientId(client, clientId),
            );

            if (message && ownedByClient) {
              applyAwarenessMessage(room.awareness, message, client);
            }
          } else {
            const reply = applySyncMessage(room.doc, bytes, client);

            if (reply) client.send(reply);
          }
        } catch {
          client.close(1003, 'Malformed message');
        }
      });

      // рукопожатие: свой SyncStep1 (клиент ответит SyncStep2) + текущее присутствие
      client.send(encodeSyncStep1(room.doc));
      client.send(
        encodeAwarenessMessage(room.awareness, [
          ...room.awareness.getStates().keys(),
        ]),
      );
    } catch {
      client.close(1011, 'Connection setup failed');
    }
  }

  async handleDisconnect(client: CollabConnection) {
    await this.collabService.detach(client);
  }
}
