import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { normalizeEmail } from '../common/utils/email';
import { isUniqueViolation } from '../database/sql-errors';
import { REFRESH_COOKIE_TTL } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  INVALID_EMAIL_OR_PASSWORD_ERROR,
  UNAUTHORIZED_ERROR,
  USER_EMAIL_ALREADY_EXISTS_ERROR,
} from './errors';
import { generateRefreshToken, hashRefreshToken } from './refresh-token';
import { RefreshTokenRepository } from './refresh-token.repository';
import { UserRepository } from './user.repository';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash!: string;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash('dummy');
  }

  public async register({ email, password }: RegisterDto) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.userRepository.findByEmail(normalizedEmail);

    if (existing) {
      throw new ConflictException(USER_EMAIL_ALREADY_EXISTS_ERROR);
    }

    const passwordHash = await argon2.hash(password);

    try {
      return await this.userRepository.create({
        email: normalizedEmail,
        passwordHash,
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(USER_EMAIL_ALREADY_EXISTS_ERROR);
      }

      this.logger.error(error);
      throw new InternalServerErrorException();
    }
  }

  public async login({ email, password }: LoginDto) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      await argon2.verify(this.dummyHash, password);
      throw new UnauthorizedException(INVALID_EMAIL_OR_PASSWORD_ERROR);
    }

    const isVerify = await argon2.verify(user.passwordHash, password);

    if (!isVerify)
      throw new UnauthorizedException(INVALID_EMAIL_OR_PASSWORD_ERROR);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = await this.createSession(user.id);

    return {
      accessToken,
      refreshToken,
    };
  }

  public async refresh(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);

    const tokenRecord = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!tokenRecord) throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    if (tokenRecord.revokedAt) {
      await this.refreshTokenRepository.revokeAllByUser(tokenRecord.userId);

      throw new UnauthorizedException(UNAUTHORIZED_ERROR);
    }

    if (tokenRecord.expiresAt < new Date())
      throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    const userRecord = await this.userRepository.findById(tokenRecord.userId);

    if (!userRecord) throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    const revokedTokenRecord = await this.refreshTokenRepository.revokeByHash(
      tokenRecord.tokenHash,
    );

    if (!revokedTokenRecord)
      throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    const accessToken = this.jwtService.sign({
      sub: userRecord.id,
      email: userRecord.email,
    });
    const newRefreshToken = await this.createSession(
      userRecord.id,
      tokenRecord.sessionId,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  public async logout(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    const tokenRecord = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!tokenRecord) return;

    await this.refreshTokenRepository.revokeBySessionId(tokenRecord.sessionId);
  }

  public async logoutAll(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    const tokenRecord = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!tokenRecord) return;

    return this.refreshTokenRepository.revokeAllByUser(tokenRecord.userId);
  }

  private async createSession(userId: string, currentSessionId?: string) {
    const sessionId = currentSessionId ?? randomUUID();
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_COOKIE_TTL);

    await this.refreshTokenRepository.create({
      userId,
      sessionId,
      tokenHash,
      expiresAt,
    });

    return refreshToken;
  }
}
