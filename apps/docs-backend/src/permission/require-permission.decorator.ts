import type { DocumentAccessLevel } from '@docs-app/contracts/document';
import { SetMetadata } from '@nestjs/common';

export const REQUIRED_DOCUMENT_ACCESS = 'required_document_access';

export const RequirePermission = (level: DocumentAccessLevel) =>
  SetMetadata(REQUIRED_DOCUMENT_ACCESS, level);
