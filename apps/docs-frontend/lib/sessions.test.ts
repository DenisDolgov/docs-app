import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from './api';
import { describeSessionDevice, listSessions, revokeSession } from './sessions';

const response = (status: number, body?: unknown): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

const SESSION_ID = '0190a2b0-0000-7000-8000-000000000001';

const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const LINUX_FIREFOX =
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';

describe('sessions api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('читает список сессий с /auth/sessions', async () => {
    const fetchMock = vi.fn(async () => response(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await listSessions();

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/auth/sessions`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('завершает сессию через DELETE /auth/sessions/:id', async () => {
    const fetchMock = vi.fn(async () => response(204));
    vi.stubGlobal('fetch', fetchMock);

    await revokeSession(SESSION_ID);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/auth/sessions/${SESSION_ID}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('ошибку отзыва отдаёт как ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response(400, {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
        }),
      ),
    );

    await expect(revokeSession(SESSION_ID)).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
    });
  });
});

describe('describeSessionDevice', () => {
  it('различает браузер и систему', () => {
    expect(describeSessionDevice(MAC_CHROME)).toMatchObject({
      browser: 'Chrome',
      os: 'macOS',
      mobile: false,
      label: 'Chrome · macOS',
    });
  });

  it('ставит Edge впереди Chrome', () => {
    expect(describeSessionDevice(WINDOWS_EDGE).label).toBe('Edge · Windows');
  });

  it('узнаёт мобильное устройство', () => {
    expect(describeSessionDevice(IPHONE_SAFARI)).toMatchObject({
      os: 'iOS',
      mobile: true,
      label: 'Safari · iOS',
    });
  });

  it('не путает Linux с Android', () => {
    expect(describeSessionDevice(LINUX_FIREFOX).label).toBe('Firefox · Linux');
  });

  it('без User-Agent не падает', () => {
    expect(describeSessionDevice(null)).toMatchObject({
      browser: null,
      os: null,
      mobile: false,
      label: 'Неизвестное устройство',
    });
  });
});
