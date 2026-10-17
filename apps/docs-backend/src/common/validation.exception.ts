import type { ProblemDetailsFieldError } from '@docs-app/contracts/http';
import { BadRequestException } from '@nestjs/common';

// Ошибка валидации входа: несёт структурированные полевые ошибки, которые
// `AllExceptionsFilter` кладёт в расширение `errors` problem+json.
export class ValidationException extends BadRequestException {
  public readonly issues: ProblemDetailsFieldError[];

  constructor(issues: ProblemDetailsFieldError[]) {
    super('Validation failed');
    this.issues = issues;
  }
}
