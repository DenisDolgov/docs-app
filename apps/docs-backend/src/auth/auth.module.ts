import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationTokenRepository } from './email-verification-token.repository';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokenRepository } from './refresh-token.repository';
import { UserRepository } from './user.repository';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
    MailModule,
  ],
  providers: [
    UserRepository,
    RefreshTokenRepository,
    EmailVerificationTokenRepository,
    JwtAuthGuard,
    AuthService,
  ],
  exports: [UserRepository, JwtAuthGuard, JwtModule],
  controllers: [AuthController],
})
export class AuthModule {}
