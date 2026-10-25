import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { RefreshTokenRepository } from '../../src/auth/refresh-token.repository';
import { RefreshTokenGcService } from '../../src/auth/refresh-token-gc.service';
import { hashToken } from '../../src/auth/token';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';
const DAY = 24 * 60 * 60 * 1000;

describe('GC refresh-токенов (integration)', () => {
  let auth: AuthService;
  let repository: RefreshTokenRepository;
  let gc: RefreshTokenGcService;
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    repository = moduleRef.get(RefreshTokenRepository);
    gc = moduleRef.get(RefreshTokenGcService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('удаляет истёкшие и отозванные старше срока хранения, живые не трогает', async () => {
    const email = `user-${randomUUID()}@example.com`;
    const user = await auth.register({ email, password: PASSWORD });
    const live = await auth.login({ email: user.email, password: PASSWORD });

    const oldExpiredHash = `old-expired-${randomUUID()}`;
    const oldRevokedHash = `old-revoked-${randomUUID()}`;

    await repository.create({
      userId: user.id,
      sessionId: randomUUID(),
      tokenHash: oldExpiredHash,
      expiresAt: new Date(Date.now() - 40 * DAY),
    });
    await repository.create({
      userId: user.id,
      sessionId: randomUUID(),
      tokenHash: oldRevokedHash,
      expiresAt: new Date(Date.now() + 10 * DAY),
    });
    await db.execute(sql`
      update auth.refresh_tokens
      set revoked_at = ${new Date(Date.now() - 40 * DAY)},
          revoked_reason = 'logout'
      where token_hash = ${oldRevokedHash}
    `);

    const deleted = await gc.cleanup();

    expect(deleted).toBeGreaterThanOrEqual(2);

    const remaining = await db.execute<{ token_hash: string }>(sql`
      select token_hash
      from auth.refresh_tokens
      where user_id = ${user.id}
    `);
    const hashes = remaining.rows.map((row) => row.token_hash);

    expect(hashes).not.toContain(oldExpiredHash);
    expect(hashes).not.toContain(oldRevokedHash);
    expect(hashes).toContain(hashToken(live.refreshToken));
  });

  it('не удаляет свежие отозванные токены: они нужны grace-детекции', async () => {
    const email = `user-${randomUUID()}@example.com`;
    const user = await auth.register({ email, password: PASSWORD });
    const first = await auth.login({ email: user.email, password: PASSWORD });

    await auth.logout(first.refreshToken);

    const deleted = await gc.cleanup();

    expect(deleted).toBe(0);

    const remaining = await db.execute<{ token_hash: string }>(sql`
      select token_hash
      from auth.refresh_tokens
      where user_id = ${user.id}
    `);

    expect(remaining.rows.map((row) => row.token_hash)).toContain(
      hashToken(first.refreshToken),
    );
  });
});
