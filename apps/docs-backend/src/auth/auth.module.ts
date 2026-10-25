import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';
import { ACCESS_TOKEN_TTL } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCookieOptions } from './auth-cookie-options';
import { EmailVerificationPolicy } from './email-verification-policy';
import { EmailVerificationTokenRepository } from './email-verification-token.repository';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordResetTokenRepository } from './password-reset-token.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RefreshTokenGcService } from './refresh-token-gc.service';
import { UserRepository } from './user.repository';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: ACCESS_TOKEN_TTL,
        },
      }),
    }),
    MailModule,
  ],
  providers: [
    UserRepository,
    RefreshTokenRepository,
    EmailVerificationTokenRepository,
    PasswordResetTokenRepository,
    JwtAuthGuard,
    AuthService,
    AuthCookieOptions,
    RefreshTokenGcService,
    EmailVerificationPolicy,
  ],
  exports: [UserRepository, JwtAuthGuard, JwtModule, EmailVerificationPolicy],
  controllers: [AuthController],
})
export class AuthModule {}
