import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { RefreshTokenRepository } from '../../src/auth/refresh-token.repository';
import { hashToken } from '../../src/auth/token';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { createTestingModule } from '../utils';

const PASSWORD = 'correct horse battery staple';

// Приёмка куска S4: пара «погасить старый + вставить новый» — одна транзакция.
// Инъекция падения в `RefreshTokenRepository.create` проходит через реальную БД,
// поэтому проверяем не сообщение об ошибке, а состояние строки старого токена.
describe('атомарная ротация (integration)', () => {
  let auth: AuthService;
  let repository: RefreshTokenRepository;
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    auth = moduleRef.get(AuthService);
    repository = moduleRef.get(RefreshTokenRepository);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  it('падение создания нового токена не гасит старый', async () => {
    const email = `user-${randomUUID()}@example.com`;
    const user = await auth.register({ email, password: PASSWORD });
    const first = await auth.login({
      email: user.email,
      password: PASSWORD,
      userAgent: 'Chrome on macOS',
      ip: '203.0.113.90',
    });

    const create = vi
      .spyOn(repository, 'create')
      .mockRejectedValueOnce(new Error('injected insert failure'));

    await expect(auth.refresh(first.refreshToken)).rejects.toThrow(
      'injected insert failure',
    );

    expect(create).toHaveBeenCalled();
    create.mockRestore();

    // Импорт fault injection не должен протечь в БД: если отзыв шёл вне
    // транзакции, здесь уже стоит revoked_at.
    const row = await db.execute<{ revoked_at: Date | null }>(sql`
      select revoked_at
      from auth.refresh_tokens
      where token_hash = ${hashToken(first.refreshToken)}
    `);

    expect(row.rows[0]?.revoked_at).toBeNull();

    // И токен по-прежнему рабочий — сессии не потеряны.
    await expect(auth.refresh(first.refreshToken)).resolves.toHaveProperty(
      'refreshToken',
    );
  });
});
