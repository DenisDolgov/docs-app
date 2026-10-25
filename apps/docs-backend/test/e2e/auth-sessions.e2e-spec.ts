import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '../../src/auth/auth.constants';
import {
  cookieValue,
  createTestApp,
  findCookie,
  readAccessToken,
} from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

type SessionBody = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
};

describe('sessions (e2e)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  const http = () => request(app.getHttpServer());

  const register = async () => {
    const email = nextEmail();

    await http().post('/auth/register').send({ email, password: PASSWORD });

    return email;
  };

  const login = async (email: string, userAgent: string) => {
    const res = await http()
      .post('/auth/login')
      .set('User-Agent', userAgent)
      .send({ email, password: PASSWORD });

    const refreshCookie = findCookie(res, REFRESH_COOKIE_NAME);

    if (!refreshCookie) throw new Error('refresh-кука не установлена');

    return {
      accessToken: readAccessToken(res),
      refreshCookie,
    };
  };

  const listSessions = (accessToken: string, refreshCookie?: string) => {
    const req = http()
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`);

    return refreshCookie ? req.set('Cookie', refreshCookie) : req;
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.init();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('отдаёт оба устройства и ровно одну текущую сессию', async () => {
    const email = await register();
    const chrome = await login(email, 'Chrome on macOS');
    await login(email, 'Firefox on Linux');

    const res = await listSessions(chrome.accessToken, chrome.refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const sessions = res.body as SessionBody[];
    expect(sessions.map((session) => session.userAgent).sort()).toEqual([
      'Chrome on macOS',
      'Firefox on Linux',
    ]);
    expect(sessions.filter((session) => session.current)).toHaveLength(1);

    const current = sessions.find((session) => session.current);
    expect(current).toMatchObject({
      userAgent: 'Chrome on macOS',
      current: true,
    });
    expect(current?.ip).toEqual(expect.any(String));
    // Контракт ответа: наружу не уезжают token_hash, session_id и user_id.
    expect(Object.keys(current ?? {}).sort()).toEqual([
      'createdAt',
      'current',
      'id',
      'ip',
      'lastUsedAt',
      'userAgent',
    ]);
  });

  it('без access-токена отвечает 401', async () => {
    const res = await http().get('/auth/sessions');

    expect(res.status).toBe(401);
  });

  it('отзыв одного устройства не ломает второе', async () => {
    const email = await register();
    const chrome = await login(email, 'Chrome on macOS');
    const firefox = await login(email, 'Firefox on Linux');

    const before = await listSessions(chrome.accessToken, chrome.refreshCookie);
    expect(before.status).toBe(200);

    const firefoxSession = (before.body as SessionBody[]).find(
      (session) => session.userAgent === 'Firefox on Linux',
    );

    if (!firefoxSession) throw new Error('сессия Firefox не найдена');

    const revoked = await http()
      .delete(`/auth/sessions/${firefoxSession.id}`)
      .set('Authorization', `Bearer ${chrome.accessToken}`)
      .set('Cookie', chrome.refreshCookie);

    expect(revoked.status).toBe(204);

    const after = await listSessions(chrome.accessToken, chrome.refreshCookie);
    expect(
      (after.body as SessionBody[]).map((session) => session.userAgent),
    ).toEqual(['Chrome on macOS']);

    const firefoxRefresh = await http()
      .post('/auth/refresh')
      .set('Cookie', firefox.refreshCookie);
    expect(firefoxRefresh.status).toBe(401);

    const chromeRefresh = await http()
      .post('/auth/refresh')
      .set('Cookie', chrome.refreshCookie);
    expect(chromeRefresh.status).toBe(200);
  });

  it('отзыв текущего устройства чистит куки', async () => {
    const email = await register();
    const chrome = await login(email, 'Chrome on macOS');

    const list = await listSessions(chrome.accessToken, chrome.refreshCookie);
    expect(list.status).toBe(200);

    const current = (list.body as SessionBody[]).find(
      (session) => session.current,
    );

    if (!current) throw new Error('текущая сессия не найдена');

    const revoked = await http()
      .delete(`/auth/sessions/${current.id}`)
      .set('Authorization', `Bearer ${chrome.accessToken}`)
      .set('Cookie', chrome.refreshCookie);

    expect(revoked.status).toBe(204);

    const accessCookie = findCookie(revoked, ACCESS_COOKIE_NAME);
    const refreshCookie = findCookie(revoked, REFRESH_COOKIE_NAME);

    expect(accessCookie).toBeTruthy();
    expect(refreshCookie).toBeTruthy();
    expect(cookieValue(accessCookie as string)).toBe('');
    expect(cookieValue(refreshCookie as string)).toBe('');
    expect(revoked.headers['set-cookie']?.join(';')).toMatch(
      /Expires=Thu, 01 Jan 1970/i,
    );
  });

  it('чужое устройство не отзывает и не раскрывает себя', async () => {
    const aliceEmail = await register();
    const bobEmail = await register();
    const alice = await login(aliceEmail, 'Chrome on macOS');
    const bob = await login(bobEmail, 'Firefox on Linux');

    const aliceList = await listSessions(
      alice.accessToken,
      alice.refreshCookie,
    );
    expect(aliceList.status).toBe(200);

    const [aliceSession] = aliceList.body as SessionBody[];

    if (!aliceSession) throw new Error('сессия Alice не найдена');

    const attempt = await http()
      .delete(`/auth/sessions/${aliceSession.id}`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .set('Cookie', bob.refreshCookie);

    // 204, а не 404: DELETE идемпотентен и не подтверждает существование
    // чужой сессии. Важно другое — сессия Alice осталась живой.
    expect(attempt.status).toBe(204);

    const aliceAfter = await listSessions(
      alice.accessToken,
      alice.refreshCookie,
    );
    expect(aliceAfter.body).toHaveLength(1);

    const aliceRefresh = await http()
      .post('/auth/refresh')
      .set('Cookie', alice.refreshCookie);
    expect(aliceRefresh.status).toBe(200);
  });

  it('отклоняет невалидный sessionId до запроса в БД', async () => {
    const email = await register();
    const chrome = await login(email, 'Chrome on macOS');

    const res = await http()
      .delete('/auth/sessions/not-a-uuid')
      .set('Authorization', `Bearer ${chrome.accessToken}`)
      .set('Cookie', chrome.refreshCookie);

    expect(res.status).toBe(400);
  });

  it('ставит refresh-куку с безопасными атрибутами по умолчанию', async () => {
    const email = await register();
    const chrome = await login(email, 'Chrome on macOS');

    expect(chrome.refreshCookie).toMatch(/HttpOnly/i);
    expect(chrome.refreshCookie).toMatch(/Secure/i);
    expect(chrome.refreshCookie).toMatch(/SameSite=Strict/i);
    expect(chrome.refreshCookie).toMatch(/Path=\/auth/i);
  });
});
