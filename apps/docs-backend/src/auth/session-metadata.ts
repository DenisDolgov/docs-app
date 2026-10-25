import type { Request } from 'express';

import { SESSION_USER_AGENT_MAX_LENGTH } from './auth.constants';
import type { SessionMetadata } from './auth.models';

// Источник IP — `req.ip`: Express сам подставит адрес из `X-Forwarded-For`,
// только если приложение явно настроено доверять прокси (`TRUST_PROXY`).
// Читать заголовок руками нельзя: клиент подделает устройство в списке.
export const readSessionMetadata = (request: Request): SessionMetadata => {
  const userAgentHeader = request.headers['user-agent'];
  const userAgent =
    typeof userAgentHeader === 'string' && userAgentHeader.length > 0
      ? userAgentHeader.slice(0, SESSION_USER_AGENT_MAX_LENGTH)
      : null;

  return {
    userAgent,
    ip: request.ip ?? null,
  };
};
