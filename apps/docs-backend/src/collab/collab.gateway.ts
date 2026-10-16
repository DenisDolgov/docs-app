import type { IncomingMessage } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';

import { ACCESS_COOKIE_NAME } from '../auth/auth.constants';
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

// Cookie-хедер upgrade-запроса парсим вручную: Express-middleware на upgrade
// может не выполняться, а `cookie-parser` нам тут недоступен.
const readCookie = (
  cookieHeader: string | undefined,
  name: string,
): string | null => {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');

    if (separator === -1) continue;

    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return null;
};

@WebSocketGateway({ path: COLLAB_WS_PATH })
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly collabService: CollabService,
    private readonly collabAccessService: CollabAccessService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(
    client: CollabConnection,
    request: IncomingMessage,
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const documentId = url.searchParams.get('documentId');
      const origin = request.headers.origin;

      // Origin проверяем и на WS-хендшейке: cookie шлётся браузером
      // автоматически, поэтому CSWSH был бы возможен без этой сверки.
      if (origin && origin !== this.configService.get<string>('CORS_ORIGIN')) {
        return client.close(4003, 'Forbidden');
      }

      if (!documentId) {
        return client.close(4000, 'Document ID is required');
      }

      const token = readCookie(request.headers.cookie, ACCESS_COOKIE_NAME);

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
