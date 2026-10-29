import { SetMetadata } from '@nestjs/common';

import type { EffectiveAccessLevel } from './permission.models';

export const REQUIRED_DOCUMENT_ACCESS = 'required_document_access';

// Вычисляемый `owner` тоже допустим: им закрыто управление share и ссылками.
export const RequirePermission = (level: EffectiveAccessLevel) =>
  SetMetadata(REQUIRED_DOCUMENT_ACCESS, level);
