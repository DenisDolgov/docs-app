import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { SESSION_USER_AGENT_MAX_LENGTH } from '../../src/auth/auth.constants';
import { readSessionMetadata } from '../../src/auth/session-metadata';

const makeRequest = (init: {
  userAgent?: string;
  ip?: string;
  forwardedFor?: string;
}): Request => {
  const headers: Record<string, string> = {};

  if (init.userAgent !== undefined) headers['user-agent'] = init.userAgent;
  if (init.forwardedFor !== undefined) {
    headers['x-forwarded-for'] = init.forwardedFor;
  }

  return { headers, ip: init.ip } as unknown as Request;
};

describe('readSessionMetadata (unit)', () => {
  it('берёт User-Agent и IP из запроса', () => {
    const request = makeRequest({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ip: '203.0.113.7',
    });

    expect(readSessionMetadata(request)).toEqual({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ip: '203.0.113.7',
    });
  });

  it('оставляет userAgent пустым, если заголовка нет', () => {
    const request = makeRequest({ ip: '203.0.113.7' });

    expect(readSessionMetadata(request).userAgent).toBeNull();
  });

  it('обрезает слишком длинный User-Agent', () => {
    const request = makeRequest({
      userAgent: 'a'.repeat(SESSION_USER_AGENT_MAX_LENGTH + 200),
      ip: '203.0.113.7',
    });

    const metadata = readSessionMetadata(request);

    expect(metadata.userAgent).toHaveLength(SESSION_USER_AGENT_MAX_LENGTH);
  });

  it('не доверяет X-Forwarded-For без явной настройки прокси', () => {
    // Доверие заголовку появится вместе с TRUST_PROXY в уроке 0027. Пока
    // источник истины — req.ip, иначе клиент подделает своё устройство.
    const request = makeRequest({
      ip: '203.0.113.7',
      forwardedFor: '198.51.100.99',
    });

    expect(readSessionMetadata(request).ip).toBe('203.0.113.7');
  });
});
