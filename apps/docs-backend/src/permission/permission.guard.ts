import {
  type DocumentAccessLevel,
  documentIdSchema,
} from '@docs-app/contracts/document';
import { documentRoute } from '@docs-app/contracts/document/routes';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AccessTokenPayload } from '../auth/auth.models';
import { ValidationException } from '../common/validation.exception';
import { DOCUMENT_NOT_FOUND_ERROR } from '../document/errors';
import { AccessPolicyService } from './access-policy.service';
import { REQUIRED_DOCUMENT_ACCESS } from './require-permission.decorator';

interface PermissionRequest {
  params: Record<string, string | undefined>;
  user?: AccessTokenPayload;
}

// Guard не знает бизнес-правил: он берёт `documentId` из path-параметров и
// спрашивает политику. Ставится в `@UseGuards` после `JwtAuthGuard` — глобально
// он выполнился бы раньше и не увидел бы `request.user`.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessPolicy: AccessPolicyService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      DocumentAccessLevel | undefined
    >(REQUIRED_DOCUMENT_ACCESS, [context.getHandler(), context.getClass()]);

    if (!required) return true;

    const request = context.switchToHttp().getRequest<PermissionRequest>();
    const documentId = request.params[documentRoute.param];

    // Guard выполняется раньше пайпов, поэтому uuid проверяем здесь: иначе
    // невалидный id дойдёт до Postgres и даст 500.
    if (!documentId || !documentIdSchema.safeParse(documentId).success) {
      throw new ValidationException([
        { path: [documentRoute.param], message: 'Invalid UUID' },
      ]);
    }

    if (!request.user) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    await this.accessPolicy.assertDocumentAccess({
      documentId,
      principal: { userId: request.user.sub },
      required,
    });

    return true;
  }
}
