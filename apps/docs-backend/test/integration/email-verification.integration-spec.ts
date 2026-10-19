import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
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
import { DATABASE, type Database } from '../../src/database/database.constants';
import { MAIL_PROVIDER } from '../../src/mail/mail.constants';
import type { OutgoingMail } from '../../src/mail/mail.models';

// Жизненный цикл одноразового токена: реальная Postgres, но без HTTP. Провайдер
// почты заменён заглушкой — токен подтверждения рождается только в письме,
// поэтому тест читает его оттуда, как это сделал бы человек. Хеш считает
// `node:crypto`, а не наш хелпер: тест — независимый оракул, а не зеркало кода.
const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const VERIFY_LINK = /\/verify-email\?token=([A-Za-z0-9_-]+)/;

const tokenFrom = (mail: OutgoingMail) => {
  const match = mail.text.match(VERIFY_LINK);

  if (!match) throw new Error('в письме нет ссылки подтверждения');

  return match[1];
};

const provider = {
  send: vi.fn<(mail: OutgoingMail) => Promise<{ messageId: string }>>(
    async () => ({ messageId: 'stub' }),
  ),
};

describe('email verification (integration)', () => {
  let auth: AuthService;
  let db: Database;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    return { email, id: user.id };
  };

  const lastToken = () => {
    const last = provider.send.mock.calls.at(-1);

    if (!last) throw new Error('письмо не отправлялось');

    return tokenFrom(last[0]);
  };

  // `db.execute` в drizzle отдаёт timestamptz строкой, в отличие от query API.
  const tokenRows = async (userId: string) => {
    const result = await db.execute<{
      token_hash: string;
      created_at: string;
      expires_at: string;
      used_at: string | null;
    }>(
      sql`select * from auth.email_verification_tokens where user_id = ${userId}`,
    );

    return result.rows;
  };

  const emailVerifiedAt = async (userId: string) => {
    const result = await db.execute<{ email_verified_at: string | null }>(
      sql`select email_verified_at from auth.users where id = ${userId}`,
    );

    return result.rows[0]?.email_verified_at ?? null;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_PROVIDER)
      .useValue(provider)
      .compile();

    auth = moduleRef.get(AuthService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(() => {
    provider.send.mockReset();
    provider.send.mockImplementation(async () => ({ messageId: 'stub' }));
  });

  it('при регистрации выдаёт токен и отправляет письмо', async () => {
    const { id, email } = await register();

    expect(provider.send).toHaveBeenCalledTimes(1);

    const mail = provider.send.mock.calls[0][0];
    expect(mail.to).toBe(email);
    expect(tokenFrom(mail)).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    // Регистрация не подтверждает адрес: пользователь лишь получает письмо.
    expect(await emailVerifiedAt(id)).toBeNull();
  });

  it('хранит хеш токена и срок жизни 24 часа, а не сам токен', async () => {
    const { id } = await register();
    const token = lastToken();

    const rows = await tokenRows(id);
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row.token_hash).toBe(sha256(token));
    expect(Object.values(row)).not.toContain(token);

    const lifetimeHours =
      (new Date(row.expires_at).getTime() -
        new Date(row.created_at).getTime()) /
      3_600_000;

    expect(lifetimeHours).toBeGreaterThan(23);
    expect(lifetimeHours).toBeLessThan(25);
  });

  it('подтверждает адрес по токену и гасит токен', async () => {
    const { id } = await register();
    const token = lastToken();

    await auth.verifyEmail(token);

    expect(await emailVerifiedAt(id)).not.toBeNull();

    const rows = await tokenRows(id);
    expect(rows[0]?.used_at).not.toBeNull();
  });

  it('принимает токен только один раз', async () => {
    const { id } = await register();
    const token = lastToken();

    await auth.verifyEmail(token);

    await expect(auth.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await emailVerifiedAt(id)).not.toBeNull();
  });

  it('отклоняет истёкший токен', async () => {
    const { id } = await register();
    const token = lastToken();

    await db.execute(
      sql`update auth.email_verification_tokens set expires_at = now() - interval '1 hour' where user_id = ${id}`,
    );

    await expect(auth.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await emailVerifiedAt(id)).toBeNull();
  });

  it('отклоняет неизвестный токен', async () => {
    await expect(auth.verifyEmail('unknown-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('повторная отправка гасит прежний токен', async () => {
    const { id, email } = await register();
    const first = lastToken();

    await auth.sendEmailVerification({ id, email });
    const second = lastToken();

    expect(second).not.toBe(first);

    await expect(auth.verifyEmail(first)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(auth.verifyEmail(second)).resolves.toBeUndefined();
  });

  it('параллельная повторная отправка оставляет один активный токен', async () => {
    const { id, email } = await register();

    await Promise.all([
      auth.sendEmailVerification({ id, email }),
      auth.sendEmailVerification({ id, email }),
    ]);

    const rows = await tokenRows(id);
    expect(rows.filter((row) => row.used_at === null)).toHaveLength(1);
  });

  it('регистрация не падает, если письмо не ушло', async () => {
    provider.send.mockRejectedValueOnce(new Error('SMTP недоступен'));

    const { id } = await register();

    // Пользователь создан, токен выдан — письмо можно запросить повторно.
    const rows = await tokenRows(id);
    expect(rows).toHaveLength(1);
  });
});
