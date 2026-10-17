import type { ProblemDetailsFieldError } from '@docs-app/contracts/http';
import { Injectable, StandardSchemaValidationPipe } from '@nestjs/common';

import { ValidationException } from './validation.exception';

// Issue стандарт-схемы: `path` — сегменты (строка/число или объект с `key`).
interface SchemaIssue {
  readonly path?: ReadonlyArray<unknown>;
  readonly message: string;
}

const toFieldErrors = (
  issues: readonly SchemaIssue[],
): ProblemDetailsFieldError[] =>
  issues.map((issue) => ({
    path: (issue.path ?? []).map((segment) =>
      typeof segment === 'object' && segment !== null && 'key' in segment
        ? ((segment as { key: string | number }).key as string | number)
        : (segment as string | number),
    ),
    message: issue.message,
  }));

// Валидация входа через Standard Schema (Nest 12). Отличие от дефолтного пайпа —
// структурированные полевые ошибки вместо плоского списка строк.
@Injectable()
export class AppValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super({
      exceptionFactory: (issues) =>
        new ValidationException(toFieldErrors(issues)),
    });
  }
}
