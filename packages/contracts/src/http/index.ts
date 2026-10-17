import { z } from 'zod';

// RFC 9457 (Problem Details for HTTP APIs) — общий конверт ошибок.
// `type` по умолчанию `about:blank`, тогда `title` — фраза HTTP-статуса,
// а конкретика едет в `detail`. Полевые ошибки валидации — расширение `errors`.
export const problemDetailsFieldErrorDto = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});

export const problemDetailsDto = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errors: z.array(problemDetailsFieldErrorDto).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsDto>;
export type ProblemDetailsFieldError = z.infer<
  typeof problemDetailsFieldErrorDto
>;
