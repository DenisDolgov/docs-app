import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from './api';
import {
  ensureRefreshed,
  resetSessionExpired,
  setSessionExpiredHandler,
  TransientError,
} from './auth-session';

const response = (status: number): Response =>
  ({ status, ok: status >= 200 && status < 300 }) as Response;

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

describe('auth-session', () => {
  let onExpired: () => void;

  beforeEach(() => {
    resetSessionExpired();
    onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
    vi.stubGlobal('navigator', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('два параллельных обновления дают один refresh', async () => {
    const deferred = createDeferred<Response>();
    const fetchMock = vi.fn(() => deferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    const first = ensureRefreshed();
    const second = ensureRefreshed();

    deferred.resolve(response(200));

    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('берёт лок docs:auth:refresh вокруг refresh', async () => {
    const request = vi.fn(
      async (_name: string, _options: unknown, callback: () => Promise<void>) =>
        callback(),
    );
    vi.stubGlobal('navigator', { locks: { request } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(200)),
    );

    await ensureRefreshed();

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('docs:auth:refresh');
  });

  it('401 при повторе: обновляет сессию и повторяет ровно один раз', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/auth/me');

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('5xx на refresh не рвёт сессию (транзиент наверх)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(TransientError);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('401 на refresh → onSessionExpired один раз', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/auth/me');

    expect(result.status).toBe(401);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('onSessionExpired дедуплицируется', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(401));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([apiFetch('/documents'), apiFetch('/organizations')]);

    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
