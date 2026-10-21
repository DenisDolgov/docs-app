import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { normalizeEmail } from '../common/utils/email';
import { isUniqueViolation } from '../database/sql-errors';
import { UnitOfWork } from '../database/unit-of-work';
import { MailService } from '../mail/mail.service';
import {
  EMAIL_VERIFICATION_TOKEN_TTL,
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS,
  PASSWORD_RESET_TOKEN_TTL,
  PASSWORD_RESET_TOKEN_TTL_HOURS,
  REFRESH_COOKIE_TTL,
  REFRESH_GRACE_PERIOD,
} from './auth.constants';
import {
  LoginParams,
  ProfileView,
  RegisterParams,
  ResetPasswordParams,
  SendEmailVerificationParams,
} from './auth.models';
import { EmailVerificationTokenRepository } from './email-verification-token.repository';
import {
  EMAIL_VERIFICATION_TOKEN_INVALID_ERROR,
  INVALID_EMAIL_OR_PASSWORD_ERROR,
  PASSWORD_RESET_TOKEN_INVALID_ERROR,
  UNAUTHORIZED_ERROR,
  USER_EMAIL_ALREADY_EXISTS_ERROR,
} from './errors';
import { PasswordResetTokenRepository } from './password-reset-token.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { generateToken, hashToken } from './token';
import { UserRepository } from './user.repository';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash!: string;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly emailVerificationTokenRepository: EmailVerificationTokenRepository,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash('dummy');
  }

  async register({ email, password }: RegisterParams) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.userRepository.findByEmail(normalizedEmail);

    if (existing) {
      throw new ConflictException(USER_EMAIL_ALREADY_EXISTS_ERROR);
    }

    const passwordHash = await argon2.hash(password);
    const verification = this.createVerificationToken();

    try {
      const userRecord = await this.userRepository.createWithVerificationToken(
        {
          email: normalizedEmail,
          passwordHash,
        },
        {
          tokenHash: verification.tokenHash,
          expiresAt: verification.expiresAt,
        },
      );

      this.sendVerificationEmail(userRecord.email, verification.token);

      return userRecord;
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(USER_EMAIL_ALREADY_EXISTS_ERROR);
      }

      // прочие ошибки логирует и превращает в 500 глобальный фильтр
      throw error;
    }
  }

  async login({ email, password }: LoginParams) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      await argon2.verify(this.dummyHash, password);
      throw new UnauthorizedException(INVALID_EMAIL_OR_PASSWORD_ERROR);
    }

    const isVerify = await argon2.verify(user.passwordHash, password);

    if (!isVerify)
      throw new UnauthorizedException(INVALID_EMAIL_OR_PASSWORD_ERROR);

    return this.issueTokens({ id: user.id, email: user.email });
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);

    const tokenRecord = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!tokenRecord) throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    if (tokenRecord.revokedAt) {
      const withinGrace =
        tokenRecord.revokedReason === 'rotated' &&
        Date.now() - tokenRecord.revokedAt.getTime() <= REFRESH_GRACE_PERIOD;

      if (withinGrace) {
        const userRecord = await this.userRepository.findById(
          tokenRecord.userId,
        );

        if (!userRecord) throw new UnauthorizedException(UNAUTHORIZED_ERROR);

        this.logger.warn(
          `Refresh-токен предъявлен повторно внутри grace-окна: sessionId=${tokenRecord.sessionId}`,
        );

        // Преемника отзываем, а не сносим все сессии: клиент, скорее всего,
        // просто не увидел ответ предыдущей ротации.
        await this.refreshTokenRepository.revokeActiveBySessionId(
          tokenRecord.sessionId,
          'rotated',
        );

        return this.issueTokens(userRecord, tokenRecord.sessionId);
      }

      await this.refreshTokenRepository.revokeAllByUser(
        tokenRecord.userId,
        'reuse',
      );

      throw new UnauthorizedException(UNAUTHORIZED_ERROR);
    }

    if (tokenRecord.expiresAt < new Date())
      throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    const userRecord = await this.userRepository.findById(tokenRecord.userId);

    if (!userRecord) throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    const revokedTokenRecord = await this.refreshTokenRepository.revokeByHash(
      tokenRecord.tokenHash,
      'rotated',
    );

    if (!revokedTokenRecord)
      throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    return this.issueTokens(userRecord, tokenRecord.sessionId);
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const tokenRecord = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!tokenRecord) return;

    await this.refreshTokenRepository.revokeBySessionId(
      tokenRecord.sessionId,
      'logout',
    );
  }

  async logoutAll(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const tokenRecord = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!tokenRecord) return;

    return this.refreshTokenRepository.revokeAllByUser(
      tokenRecord.userId,
      'logout_all',
    );
  }

  async sendEmailVerification({ id, email }: SendEmailVerificationParams) {
    const { token, tokenHash, expiresAt } = this.createVerificationToken();

    await this.emailVerificationTokenRepository.replaceForUser(id, {
      tokenHash,
      expiresAt,
    });

    this.sendVerificationEmail(email, token);
  }

  async verifyEmail(token: string) {
    const tokenRecord = await this.emailVerificationTokenRepository.consume(
      hashToken(token),
    );

    if (!tokenRecord) {
      throw new BadRequestException(EMAIL_VERIFICATION_TOKEN_INVALID_ERROR);
    }

    await this.userRepository.markEmailVerified(tokenRecord.userId);
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = normalizeEmail(email);

    const userRecord = await this.userRepository.findByEmail(normalizedEmail);

    if (!userRecord) return;

    const { token, tokenHash, expiresAt } = this.createPasswordResetToken();

    await this.passwordResetTokenRepository.replaceForUser(userRecord.id, {
      tokenHash,
      expiresAt,
    });

    this.sendPasswordResetEmail(userRecord.email, token);
  }

  async resetPassword({ password, token }: ResetPasswordParams) {
    const tokenHash = hashToken(token);

    // Дешёвое чтение без блокировки: нужно знать пользователя, чтобы взять тот
    // же advisory-lock, что и при выпуске токена, и не хешировать мусор.
    const activeToken =
      await this.passwordResetTokenRepository.findActive(tokenHash);

    if (!activeToken) {
      throw new BadRequestException(PASSWORD_RESET_TOKEN_INVALID_ERROR);
    }

    const passwordHash = await argon2.hash(password);

    // Всё остальное — одна единица работы. Любое исключение внутри откатит
    // и погашение токена, и смену пароля, и отзыв сессий.
    await this.unitOfWork.run(async (tx) => {
      await this.passwordResetTokenRepository.lockUser(activeToken.userId, tx);

      const tokenRecord = await this.passwordResetTokenRepository.consume(
        tokenHash,
        tx,
      );

      if (!tokenRecord) {
        throw new BadRequestException(PASSWORD_RESET_TOKEN_INVALID_ERROR);
      }

      const userRecord = await this.userRepository.resetPassword(
        tokenRecord.userId,
        passwordHash,
        tx,
      );

      if (!userRecord) {
        throw new BadRequestException(PASSWORD_RESET_TOKEN_INVALID_ERROR);
      }

      await this.refreshTokenRepository.revokeAllByUser(
        userRecord.id,
        'password_reset',
        tx,
      );

      await this.passwordResetTokenRepository.consumeAllForUser(
        userRecord.id,
        tx,
      );
    });
  }

  // TODO(вынос): проверка «пользователь из токена ещё существует» дублирует
  // EmailVerificationPolicy. Появится третий потребитель — вынести общий
  // getUserOrThrow в AuthService/UserRepository.
  async getProfile(id: string): Promise<ProfileView> {
    const userRecord = await this.userRepository.findById(id);

    if (!userRecord) throw new UnauthorizedException(UNAUTHORIZED_ERROR);

    return {
      id: userRecord.id,
      email: userRecord.email,
      emailVerified: !!userRecord.emailVerifiedAt,
    };
  }

  private createVerificationToken() {
    const token = generateToken();

    return {
      token,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL),
    };
  }

  private createPasswordResetToken() {
    const token = generateToken();

    return {
      token,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL),
    };
  }

  // Письмо не должно задерживать HTTP-ответ: SMTP ждём в фоне. Ошибку логируем,
  // но отправитель о ней не узнает. Надёжная доставка — через outbox (TD26).
  private sendVerificationEmail(email: string, token: string) {
    void this.mailService
      .sendVerification({
        to: email,
        token,
        ttlHours: EMAIL_VERIFICATION_TOKEN_TTL_HOURS,
      })
      .catch((error: unknown) => {
        this.logger.error(
          { email, err: error },
          'failed to send verification email',
        );
      });
  }

  private sendPasswordResetEmail(email: string, token: string) {
    void this.mailService
      .sendPasswordReset({
        to: email,
        token,
        ttlHours: PASSWORD_RESET_TOKEN_TTL_HOURS,
      })
      .catch((error: unknown) => {
        this.logger.error(
          { email, err: error },
          'failed to send password reset email',
        );
      });
  }

  private async issueTokens(
    user: { id: string; email: string },
    sessionId?: string,
  ) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = await this.createSession(user.id, sessionId);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async createSession(userId: string, currentSessionId?: string) {
    const sessionId = currentSessionId ?? randomUUID();
    const refreshToken = generateToken();
    const tokenHash = hashToken(refreshToken);
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
