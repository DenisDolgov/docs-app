import type { WebSocket } from 'ws';

import type { OrganizationRole } from '../database/schema/organizations';

export interface CollabConnection extends WebSocket {
  documentId: string;
}

export interface ResolveAccessParams {
  documentId: string;
  userId: string;
}

export interface CollabAccess {
  organizationId: string;
  role: OrganizationRole;
}
