import { randomBytes, randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { hashRefreshToken } from '../../src/auth/refresh-token';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestApp } from '../utils';

const PASSWORD = 'correct horse battery staple';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('auth (integration)', () => {
  let auth: AuthService;
  let db: Database;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    return { email, id: user.id };
  };

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    auth = moduleRef.get(AuthService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('хранит argon2id-хеш, а не открытый пароль', async () => {
    const { email } = await register();

    const result = await db.execute<{ password_hash: string }>(
      sql`select password_hash from auth.users where email = ${email}`,
    );

    const hash = result.rows[0]?.password_hash;

    if (hash === undefined) {
      throw new Error('password_hash не записан в auth.users');
    }
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(argon2.verify(hash, PASSWORD)).resolves.toBe(true);
  });

  it('создаёт таблицу auth.users с нужными колонками', async () => {
    const result = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
where table_schema = 'auth' and table_name = 'users' order by column_name`,
    );

    expect(result.rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'email',
      'id',
      'password_hash',
    ]);
  });

  it('подписывает JWT с sub пользователя и коротким сроком жизни', async () => {
    const { email } = await register();

    const { accessToken } = await auth.login({ email, password: PASSWORD });

    const payload = new JwtService({ secret: ACCESS_SECRET }).verify<{
      sub: string;
      email: string;
      iat: number;
      exp: number;
    }>(accessToken);

    expect(payload.sub).toEqual(expect.any(String));
    expect(payload.email).toBe(email);

    const ttlSeconds = payload.exp - payload.iat;
    expect(ttlSeconds).toBeGreaterThan(0);
    expect(ttlSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it('хранит только sha256-хеш refresh-токена, а не сам токен', async () => {
    const { email } = await register();

    const { refreshToken } = await auth.login({ email, password: PASSWORD });

    const result = await db.execute<Record<string, unknown>>(
      sql`select * from auth.refresh_tokens`,
    );

    const rows = result.rows;
    const hashed = rows.some(
      (row) => row.token_hash === hashRefreshToken(refreshToken),
    );

    expect(hashed).toBe(true);

    const plaintextLeaked = rows.some((row) =>
      Object.values(row).some((value) => value === refreshToken),
    );

    expect(plaintextLeaked).toBe(false);
  });

  it('отклоняет истёкший refresh-токен', async () => {
    const { id } = await register();
    const expired = randomBytes(32).toString('base64url');

    await db.execute(
      sql`insert into auth.refresh_tokens (user_id, session_id, token_hash, expires_at)
          values (${id}, ${randomUUID()}, ${hashRefreshToken(expired)}, now() - interval '1 day')`,
    );

    await expect(auth.refresh(expired)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
