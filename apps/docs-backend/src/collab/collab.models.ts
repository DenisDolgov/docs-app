import type { WebSocket } from 'ws';

export interface CollabConnection extends WebSocket {
  documentId?: string;
}
