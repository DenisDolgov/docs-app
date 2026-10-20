import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { MAIL_PROVIDER } from '../../src/mail/mail.constants';
import type { OutgoingMail } from '../../src/mail/mail.models';

// Жизненный цикл токена сброса пароля: реальная Postgres, без HTTP. Провайдер
// почты подменён заглушкой — токен рождается только в письме, поэтому тест
// достаёт его оттуда. Хеш считает `node:crypto`, а не наш хелпер: тест —
// независимый оракул, а не зеркало кода.
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'new correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const RESET_LINK = /\/reset-password\?token=([A-Za-z0-9_-]+)/;

const tokenFrom = (mail: OutgoingMail) => {
  const match = mail.text.match(RESET_LINK);

  if (!match) throw new Error('в письме нет ссылки сброса пароля');

  return match[1];
};

const provider = {
  send: vi.fn<(mail: OutgoingMail) => Promise<{ messageId: string }>>(
    async () => ({ messageId: 'stub' }),
  ),
};

describe('password reset (integration)', () => {
  let auth: AuthService;
  let db: Database;
  let users: UserRepository;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    return { email, id: user.id };
  };

  const requestReset = async (email: string) => {
    provider.send.mockClear();
    await auth.requestPasswordReset(email);

    const mail = provider.send.mock.calls.at(-1)?.[0];

    if (!mail) throw new Error('письмо сброса пароля не отправлялось');

    return { mail, token: tokenFrom(mail) };
  };

  // `db.execute` в drizzle отдаёт timestamptz строкой, в отличие от query API.
  const tokenRows = async (userId: string) => {
    const result = await db.execute<{
      token_hash: string;
      created_at: string;
      expires_at: string;
      used_at: string | null;
    }>(sql`select * from auth.password_reset_tokens where user_id = ${userId}`);

    return result.rows;
  };

  const passwordHash = async (userId: string) => {
    const result = await db.execute<{ password_hash: string }>(
      sql`select password_hash from auth.users where id = ${userId}`,
    );

    return result.rows[0]?.password_hash ?? '';
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_PROVIDER)
      .useValue(provider)
      .compile();

    auth = moduleRef.get(AuthService);
    db = moduleRef.get(DATABASE);
    users = moduleRef.get(UserRepository);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(() => {
    provider.send.mockReset();
    provider.send.mockImplementation(async () => ({ messageId: 'stub' }));
  });

  it('по запросу шлёт письмо и хранит только хеш токена', async () => {
    const { id, email } = await register();
    const { mail, token } = await requestReset(email);

    expect(mail.to).toBe(email);
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const rows = await tokenRows(id);
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.token_hash).toBe(sha256(token));
    expect(Object.values(row)).not.toContain(token);

    const lifetimeHours =
      (new Date(row.expires_at).getTime() -
        new Date(row.created_at).getTime()) /
      3_600_000;

    expect(lifetimeHours).toBeGreaterThan(0.9);
    expect(lifetimeHours).toBeLessThan(1.1);
  });

  it('не шлёт письмо для неизвестного адреса', async () => {
    const email = nextEmail();

    provider.send.mockClear();

    await expect(auth.requestPasswordReset(email)).resolves.toBeUndefined();
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('сбрасывает пароль и хранит его argon2id-хеш', async () => {
    const { id, email } = await register();
    const { token } = await requestReset(email);

    await auth.resetPassword({ token, password: NEW_PASSWORD });

    await expect(
      auth.login({ email, password: PASSWORD }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      auth.login({ email, password: NEW_PASSWORD }),
    ).resolves.toBeDefined();

    const rows = await tokenRows(id);
    expect(rows[0]?.used_at).not.toBeNull();

    const hash = await passwordHash(id);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain(NEW_PASSWORD);
  });

  it('принимает токен только один раз', async () => {
    const { email } = await register();
    const { token } = await requestReset(email);

    await auth.resetPassword({ token, password: NEW_PASSWORD });

    await expect(
      auth.resetPassword({ token, password: PASSWORD }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отклоняет истёкший токен', async () => {
    const { id, email } = await register();
    const { token } = await requestReset(email);

    await db.execute(
      sql`update auth.password_reset_tokens set expires_at = now() - interval '1 hour' where user_id = ${id}`,
    );

    await expect(
      auth.resetPassword({ token, password: NEW_PASSWORD }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      auth.login({ email, password: PASSWORD }),
    ).resolves.toBeDefined();
  });

  it('отклоняет неизвестный токен', async () => {
    await expect(
      auth.resetPassword({ token: 'unknown-token', password: NEW_PASSWORD }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('повторный запрос гасит прежний токен', async () => {
    const { id, email } = await register();

    const first = await requestReset(email);
    const second = await requestReset(email);

    expect(second.token).not.toBe(first.token);

    const rows = await tokenRows(id);
    const active = rows.filter(
      (row) => row.used_at === null && new Date(row.expires_at) > new Date(),
    );

    expect(active).toHaveLength(1);

    await expect(
      auth.resetPassword({ token: first.token, password: NEW_PASSWORD }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      auth.resetPassword({ token: second.token, password: NEW_PASSWORD }),
    ).resolves.toBeUndefined();
  });

  it('сброс пароля отзывает все сессии пользователя', async () => {
    const { email } = await register();

    const firstSession = await auth.login({ email, password: PASSWORD });
    const secondSession = await auth.login({ email, password: PASSWORD });

    const { token } = await requestReset(email);

    await auth.resetPassword({ token, password: NEW_PASSWORD });

    await expect(
      auth.refresh(firstSession.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      auth.refresh(secondSession.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('параллельный сброс одним токеном проходит ровно один раз', async () => {
    const { email } = await register();
    const { token } = await requestReset(email);

    const results = await Promise.allSettled([
      auth.resetPassword({ token, password: NEW_PASSWORD }),
      auth.resetPassword({ token, password: PASSWORD }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      BadRequestException,
    );
  });

  it('не сжигает токен, если запись пароля упала', async () => {
    const { id, email } = await register();
    const { token } = await requestReset(email);
    const resetPassword = vi
      .spyOn(users, 'resetPassword')
      .mockRejectedValueOnce(new Error('boom'));

    try {
      await expect(
        auth.resetPassword({ token, password: NEW_PASSWORD }),
      ).rejects.toThrow('boom');
    } finally {
      resetPassword.mockRestore();
    }

    const rows = await tokenRows(id);
    expect(rows[0]?.used_at).toBeNull();

    await expect(
      auth.login({ email, password: PASSWORD }),
    ).resolves.toBeDefined();
  });

  it('гасит остальные активные токены сброса', async () => {
    const { id, email } = await register();
    const { token } = await requestReset(email);
    const otherToken = randomBytes(32).toString('base64url');

    await db.execute(
      sql`insert into auth.password_reset_tokens (user_id, token_hash, expires_at)
          values (${id}, ${sha256(otherToken)}, now() + interval '1 hour')`,
    );

    await auth.resetPassword({ token, password: NEW_PASSWORD });

    const rows = await tokenRows(id);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.used_at !== null)).toBe(true);
  });
});
