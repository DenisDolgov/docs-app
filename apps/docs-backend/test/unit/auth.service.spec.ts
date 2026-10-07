import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { RefreshTokenRepository } from '../../src/auth/refresh-token.repository';
import { UserRepository } from '../../src/auth/user.repository';

vi.mock('argon2', () => ({
  hash: vi.fn(async () => '$argon2id$dummy'),
  verify: vi.fn(async () => true),
}));

const DUMMY_HASH = '$argon2id$dummy';
const PASSWORD = 'correct horse battery staple';

const userRepository = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
};

const refreshTokenRepository = {
  create: vi.fn(),
  findByHash: vi.fn(),
  revokeByHash: vi.fn(),
  revokeBySessionId: vi.fn(),
  revokeAllByUser: vi.fn(),
};

const jwtService = {
  sign: vi.fn(() => 'signed.access.token'),
};

describe('AuthService (unit)', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepository },
        { provide: RefreshTokenRepository, useValue: refreshTokenRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    await service.onModuleInit();
  });

  describe('login', () => {
    it('отвечает 401 на неизвестный email', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('гоняет argon2.verify по dummy-хешу, даже когда пользователя нет', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await service
        .login({ email: 'ghost@example.com', password: PASSWORD })
        .catch(() => undefined);

      expect(argon2.verify).toHaveBeenCalledTimes(1);
      expect(argon2.verify).toHaveBeenCalledWith(DUMMY_HASH, PASSWORD);
    });

    it('отвечает 401 на неверный пароль и не заводит сессию', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: '$argon2id$real',
      });
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);

      await expect(
        service.login({ email: 'user@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    });

    it('нормализует email перед поиском пользователя', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await service
        .login({ email: '  User@Example.COM ', password: PASSWORD })
        .catch(() => undefined);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(
        'user@example.com',
      );
    });

    it('на верные данные выдаёт access-токен и заводит сессию', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: '$argon2id$real',
      });
      vi.mocked(argon2.verify).mockResolvedValueOnce(true);
      refreshTokenRepository.create.mockResolvedValue(undefined);

      const result = await service.login({
        email: 'user@example.com',
        password: PASSWORD,
      });

      expect(result.accessToken).toBe('signed.access.token');
      expect(typeof result.refreshToken).toBe('string');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'user@example.com',
      });
      expect(refreshTokenRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    it('отвечает 401 на неизвестный токен', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue(null);

      await expect(service.refresh('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('на отозванный токен отзывает всю сессию (reuse-детекция)', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        tokenHash: 'hash-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.refresh('reused')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(refreshTokenRepository.revokeAllByUser).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('проверяет reuse раньше срока жизни', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        tokenHash: 'hash-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() - 60_000),
      });

      await service.refresh('reused-and-expired').catch(() => undefined);

      expect(refreshTokenRepository.revokeAllByUser).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('отвечает 401 на истёкший токен и не выпускает новый', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        tokenHash: 'hash-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.refresh('expired')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    });

    it('отвечает 401, если пользователь токена больше не существует', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        tokenHash: 'hash-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      userRepository.findById.mockResolvedValue(null);

      await expect(service.refresh('valid')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('отвечает 401, если строку не удалось атомарно отозвать (гонка)', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        tokenHash: 'hash-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      refreshTokenRepository.revokeByHash.mockResolvedValue(undefined);

      await expect(service.refresh('racing')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(refreshTokenRepository.create).not.toHaveBeenCalled();
    });

    it('ротирует токен в той же сессии и выдаёт новый access', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        tokenHash: 'hash-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      userRepository.findById.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });
      refreshTokenRepository.revokeByHash.mockResolvedValue({
        tokenHash: 'hash-1',
      });

      const result = await service.refresh('valid');

      expect(refreshTokenRepository.revokeByHash).toHaveBeenCalledWith(
        'hash-1',
      );
      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', sessionId: 'session-1' }),
      );
      expect(result.accessToken).toBe('signed.access.token');
    });
  });

  describe('logout', () => {
    it('молча выходит, если токен неизвестен', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue(null);

      await expect(service.logout('unknown')).resolves.toBeUndefined();
      expect(refreshTokenRepository.revokeBySessionId).not.toHaveBeenCalled();
    });

    it('гасит сессию по session_id', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        tokenHash: 'hash-1',
      });

      await service.logout('valid');

      expect(refreshTokenRepository.revokeBySessionId).toHaveBeenCalledWith(
        'session-1',
      );
    });
  });

  describe('logoutAll', () => {
    it('гасит все сессии пользователя', async () => {
      refreshTokenRepository.findByHash.mockResolvedValue({
        userId: 'user-1',
        sessionId: 'session-1',
        tokenHash: 'hash-1',
      });

      await service.logoutAll('valid');

      expect(refreshTokenRepository.revokeAllByUser).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('register', () => {
    it('отвечает 409, если email уже занят, и не пишет в базу', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.register({ email: 'user@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('превращает нарушение уникальности из БД в 409', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockRejectedValue({ code: '23505' });

      await expect(
        service.register({ email: 'user@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('нормализует email и хеширует пароль при создании', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      });

      await service.register({
        email: '  User@Example.COM ',
        password: PASSWORD,
      });

      expect(userRepository.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        passwordHash: DUMMY_HASH,
      });
    });
  });
});
