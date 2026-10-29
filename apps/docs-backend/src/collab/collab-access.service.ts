import { Injectable } from '@nestjs/common';

import { AccessPolicyService } from '../permission/access-policy.service';
import { hasAccess } from '../permission/permission.constants';
import type { ResolveAccessParams } from './collab.models';

// Правом на комнату владеет политика, здесь только порог: совместное
// редактирование требует `editor`. Viewer читает документ по HTTP, но не
// подключается к CRDT-комнате.
@Injectable()
export class CollabAccessService {
  constructor(private readonly accessPolicy: AccessPolicyService) {}

  async canEdit({ documentId, userId }: ResolveAccessParams): Promise<boolean> {
    const level = await this.accessPolicy.getDocumentAccess({
      documentId,
      principal: { userId },
    });

    return hasAccess(level, 'editor');
  }
}
