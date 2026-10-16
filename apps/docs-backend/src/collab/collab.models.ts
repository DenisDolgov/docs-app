import type { WebSocket } from 'ws';

export interface CollabConnection extends WebSocket {
  documentId: string;
}

export interface ResolveAccessParams {
  documentId: string;
  userId: string;
}
