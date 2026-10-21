import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  API_URL,
  ApiError,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from './api';

const response = (status: number, body?: unknown): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

const problem = (status: number, detail: string) => ({
  type: 'about:blank',
  title: 'Ошибка',
  status,
  detail,
});

describe('auth api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('запрос сброса пароля шлёт почту на /auth/password/forgot', async () => {
    const fetchMock = vi.fn(async () => response(204));
    vi.stubGlobal('fetch', fetchMock);

    await requestPasswordReset('user@example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/auth/password/forgot`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    );
  });

  it('сброс пароля передаёт одноразовый токен и новый пароль', async () => {
    const fetchMock = vi.fn(async () => response(204));
    vi.stubGlobal('fetch', fetchMock);

    await resetPassword('a'.repeat(43), 'new-password');

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/auth/password/reset`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(43),
          password: 'new-password',
        }),
      }),
    );
  });

  it('подтверждение почты передаёт токен из ссылки', async () => {
    const fetchMock = vi.fn(async () => response(204));
    vi.stubGlobal('fetch', fetchMock);

    await verifyEmail('b'.repeat(43));

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/auth/email/verify`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'b'.repeat(43) }),
      }),
    );
  });

  it('невалидный токен подтверждения отдаёт ApiError со статусом 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response(
          400,
          problem(400, 'Email verification token is invalid or expired'),
        ),
      ),
    );

    await expect(verifyEmail('c'.repeat(43))).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
    });
    await expect(verifyEmail('c'.repeat(43))).rejects.toBeInstanceOf(ApiError);
  });
});
