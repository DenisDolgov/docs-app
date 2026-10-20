import {
  loginDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  registerDto,
  requestPasswordResetDto,
  resetPasswordDto,
  userResponseDto,
  VerifyEmailDto,
  verifyEmailDto,
} from '@docs-app/contracts/auth';
import { authRoute } from '@docs-app/contracts/auth/routes';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  SerializeOptions,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import {
  ACCESS_COOKIE_NAME,
  ACCESS_COOKIE_TTL,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_TTL,
} from './auth.constants';
import { AccessTokenPayload } from './auth.models';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { UNAUTHORIZED_ERROR } from './errors';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller(authRoute.base)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(authRoute.register)
  @SerializeOptions({ schema: userResponseDto })
  @ApiCreatedResponse({ standardSchema: userResponseDto })
  register(@Body({ schema: registerDto }) body: z.infer<typeof registerDto>) {
    return this.authService.register(body);
  }

  @Post(authRoute.login)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginDto }) body: z.infer<typeof loginDto>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(body);

    this.setAccessTokenCookie(res, accessToken);
    this.setRefreshTokenCookie(res, refreshToken);
  }

  @Post(authRoute.refresh)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException(UNAUTHORIZED_ERROR);
    }

    try {
      const { accessToken, refreshToken: newRefreshToken } =
        await this.authService.refresh(refreshToken);

      this.setAccessTokenCookie(res, accessToken);
      this.setRefreshTokenCookie(res, newRefreshToken);
    } catch (error) {
      // httpOnly-куки клиент удалить не может — чистит сервер.
      this.clearAuthCookies(res);
      throw error;
    }
  }

  @Post(authRoute.logout)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    this.clearAuthCookies(res);
  }

  @Post(authRoute.logoutAll)
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await this.authService.logoutAll(refreshToken);
    }

    this.clearAuthCookies(res);
  }

  @Get(authRoute.me)
  @UseGuards(JwtAuthGuard)
  @SerializeOptions({ schema: userResponseDto })
  @ApiOkResponse({ standardSchema: userResponseDto })
  me(@CurrentUser() user: AccessTokenPayload) {
    return {
      email: user.email,
      id: user.sub,
    };
  }

  @Post(authRoute.verifyEmail)
  @HttpCode(HttpStatus.NO_CONTENT)
  verifyEmail(
    @Body({ schema: verifyEmailDto }) body: VerifyEmailDto,
  ): Promise<void> {
    return this.authService.verifyEmail(body.token);
  }

  @Post(authRoute.resendEmail)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  resendEmail(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.sendEmailVerification({
      id: user.sub,
      email: user.email,
    });
  }

  @Post(authRoute.resetPassword)
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body({ schema: resetPasswordDto }) body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Post(authRoute.requestPasswordReset)
  @HttpCode(HttpStatus.NO_CONTENT)
  requestPasswordReset(
    @Body({ schema: requestPasswordResetDto }) {
      email,
    }: RequestPasswordResetDto,
  ) {
    return this.authService.requestPasswordReset(email);
  }

  private setAccessTokenCookie(res: Response, accessToken: string) {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_COOKIE_TTL,
      // Префикс `__Host-` требует Secure в любом окружении, иначе браузер
      // отбросит куку; localhost браузеры считают доверенным origin.
      secure: true,
    });
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: REFRESH_COOKIE_TTL,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE_NAME, {
      path: '/',
      secure: true,
    });
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: '/auth',
      secure: process.env.NODE_ENV === 'production',
    });
  }
}
