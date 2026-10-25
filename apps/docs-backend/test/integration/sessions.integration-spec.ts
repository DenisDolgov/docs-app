import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('sessions (integration)', () => {
  let auth: AuthService;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();

    return auth.register({ email, password: PASSWORD });
  };

  const login = (
    email: string,
    userAgent: string,
    ip: string,
  ): ReturnType<AuthService['login']> =>
    auth.login({ email, password: PASSWORD, userAgent, ip });

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('показывает по одной сессии на вход и помечает текущую', async () => {
    const user = await register();
    const chrome = await login(user.email, 'Chrome on macOS', '203.0.113.10');
    await login(user.email, 'Firefox on Linux', '198.51.100.20');

    const sessions = await auth.listSessions(user.id, chrome.refreshToken);

    expect(sessions).toHaveLength(2);
    expect(sessions.filter((session) => session.current)).toHaveLength(1);

    const current = sessions.find((session) => session.current);
    expect(current).toMatchObject({
      userAgent: 'Chrome on macOS',
      ip: '203.0.113.10',
    });
    expect(
      sessions.find((session) => session.userAgent === 'Firefox on Linux'),
    ).toMatchObject({
      ip: '198.51.100.20',
      current: false,
    });

    for (const session of sessions) {
      expect(session.id).toEqual(expect.any(String));
      // Наружу даты уходят ISO-строками, а не Date из драйвера.
      expect(new Date(session.createdAt).toISOString()).toBe(session.createdAt);
      expect(new Date(session.lastUsedAt).toISOString()).toBe(
        session.lastUsedAt,
      );
    }
  });

  it('ротация не создаёт второе устройство и двигает lastUsedAt', async () => {
    const user = await register();
    const first = await login(user.email, 'Safari on iOS', '203.0.113.30');

    await new Promise((resolve) => setTimeout(resolve, 20));
    const rotated = await auth.refresh(first.refreshToken);
    const rotatedAgain = await auth.refresh(rotated.refreshToken);

    const sessions = await auth.listSessions(
      user.id,
      rotatedAgain.refreshToken,
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      userAgent: 'Safari on iOS',
      ip: '203.0.113.30',
      current: true,
    });
    expect(new Date(sessions[0].lastUsedAt).getTime()).toBeGreaterThan(
      new Date(sessions[0].createdAt).getTime(),
    );
  });

  it('отзыв устройства гасит только его токены', async () => {
    const user = await register();
    const chrome = await login(user.email, 'Chrome on Windows', '203.0.113.40');
    const firefox = await login(user.email, 'Firefox on Linux', '203.0.113.41');

    const sessions = await auth.listSessions(user.id, chrome.refreshToken);
    const firefoxSession = sessions.find(
      (session) => session.userAgent === 'Firefox on Linux',
    );

    if (!firefoxSession) throw new Error('сессия Firefox не найдена');

    await expect(
      auth.revokeSession(user.id, firefoxSession.id, chrome.refreshToken),
    ).resolves.toBe(false);

    await expect(auth.refresh(firefox.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(auth.refresh(chrome.refreshToken)).resolves.toHaveProperty(
      'refreshToken',
    );

    const after = await auth.listSessions(user.id, chrome.refreshToken);
    expect(after.map((session) => session.userAgent)).toEqual([
      'Chrome on Windows',
    ]);
  });

  it('не отзывает сессию другого пользователя', async () => {
    const alice = await register();
    const bob = await register();
    const aliceLogin = await login(alice.email, 'Chrome', '203.0.113.50');
    const bobLogin = await login(bob.email, 'Firefox', '203.0.113.51');

    const [aliceSession] = await auth.listSessions(
      alice.id,
      aliceLogin.refreshToken,
    );

    if (!aliceSession) throw new Error('сессия Alice не найдена');

    await expect(
      auth.revokeSession(bob.id, aliceSession.id, bobLogin.refreshToken),
    ).resolves.toBe(false);

    await expect(
      auth.listSessions(alice.id, aliceLogin.refreshToken),
    ).resolves.toHaveLength(1);
    await expect(auth.refresh(aliceLogin.refreshToken)).resolves.toHaveProperty(
      'refreshToken',
    );
    await expect(auth.refresh(bobLogin.refreshToken)).resolves.toHaveProperty(
      'refreshToken',
    );
  });

  it('сообщает, что текущая сессия отозвана, и убирает её из списка', async () => {
    const user = await register();
    const current = await login(user.email, 'Chrome on macOS', '203.0.113.60');

    const [session] = await auth.listSessions(user.id, current.refreshToken);

    if (!session) throw new Error('сессия не найдена');

    await expect(
      auth.revokeSession(user.id, session.id, current.refreshToken),
    ).resolves.toBe(true);

    await expect(
      auth.listSessions(user.id, current.refreshToken),
    ).resolves.toEqual([]);
    await expect(auth.refresh(current.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('без refresh-куки ни одна сессия не текущая', async () => {
    const user = await register();
    await login(user.email, 'Chrome on macOS', '203.0.113.70');

    const sessions = await auth.listSessions(user.id);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].current).toBe(false);
  });
});
