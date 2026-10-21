import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailVerificationPolicy } from '../../src/auth/email-verification-policy';
import { UserRepository } from '../../src/auth/user.repository';

// Политика — чистая логика «можно или нельзя» поверх одной выборки. Уровень unit:
// репозиторий подменён, Postgres и Nest-приложение не нужны.
const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';

const usersRepository = {
  findById: vi.fn(),
};

const userRecord = (emailVerifiedAt: Date | null) => ({
  id: USER_ID,
  email: USER_EMAIL,
  emailVerifiedAt,
});

describe('EmailVerificationPolicy', () => {
  let policy: EmailVerificationPolicy;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailVerificationPolicy,
        { provide: UserRepository, useValue: usersRepository },
      ],
    }).compile();

    policy = moduleRef.get(EmailVerificationPolicy);
  });

  it('пропускает пользователя с заполненным email_verified_at', async () => {
    usersRepository.findById.mockResolvedValue(userRecord(new Date()));

    await expect(policy.assertEmailVerified(USER_ID)).resolves.toBeUndefined();
    expect(usersRepository.findById).toHaveBeenCalledWith(USER_ID);
  });

  it('отказывает пользователю с пустым email_verified_at', async () => {
    usersRepository.findById.mockResolvedValue(userRecord(null));

    await expect(policy.assertEmailVerified(USER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('отдаёт 403 с отдельным текстом, чтобы клиент знал причину', async () => {
    usersRepository.findById.mockResolvedValue(userRecord(null));

    await expect(policy.assertEmailVerified(USER_ID)).rejects.toThrow(
      'Email is not verified',
    );
  });

  it('отвечает 401, если пользователя из токена уже нет', async () => {
    usersRepository.findById.mockResolvedValue(undefined);

    await expect(policy.assertEmailVerified(USER_ID)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
