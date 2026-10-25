import {
  loginDto,
  meResponseDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  registerDto,
  requestPasswordResetDto,
  resetPasswordDto,
  sessionIdSchema,
  sessionResponseDto,
  userResponseDto,
  VerifyEmailDto,
  verifyEmailDto,
} from '@docs-app/contracts/auth';
import { authRoute } from '@docs-app/contracts/auth/routes';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from './auth.constants';
import { AccessTokenPayload } from './auth.models';
import { AuthService } from './auth.service';
import { AuthCookieOptions } from './auth-cookie-options';
import { CurrentUser } from './current-user.decorator';
import { UNAUTHORIZED_ERROR } from './errors';
import { JwtAuthGuard } from './jwt-auth.guard';
import { readSessionMetadata } from './session-metadata';

@Controller(authRoute.base)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieOptions: AuthCookieOptions,
  ) {}

  @Post(authRoute.register)
  @SerializeOptions({ schema: userResponseDto })
  @ApiCreatedResponse({ standardSchema: userResponseDto })
  register(@Body({ schema: registerDto }) body: z.infer<typeof registerDto>) {
    return this.authService.register(body);
  }

  @Post(authRoute.login)
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() req: Request,
    @Body({ schema: loginDto }) body: z.infer<typeof loginDto>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login({
      ...body,
      ...readSessionMetadata(req),
    });

    this.setAuthCookies(res, accessToken, refreshToken);
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

      this.setAuthCookies(res, accessToken, newRefreshToken);
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
  @SerializeOptions({ schema: meResponseDto })
  @ApiOkResponse({ standardSchema: meResponseDto })
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.getProfile(user.sub);
  }

  // Текущую сессию определяем по refresh-куке: access-токен живёт 15 минут и
  // не знает, из какого устройства он выдан.
  @Get(authRoute.sessions)
  @UseGuards(JwtAuthGuard)
  @SerializeOptions({ schema: sessionResponseDto })
  @ApiOkResponse({ standardSchema: sessionResponseDto, isArray: true })
  listSessions(@CurrentUser() user: AccessTokenPayload, @Req() req: Request) {
    return this.authService.listSessions(
      user.sub,
      req.cookies[REFRESH_COOKIE_NAME],
    );
  }

  @Delete(authRoute.sessionPattern)
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AccessTokenPayload,
    @Param(authRoute.sessionParam, { schema: sessionIdSchema })
    sessionId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const revokedCurrent = await this.authService.revokeSession(
      user.sub,
      sessionId,
      req.cookies[REFRESH_COOKIE_NAME],
    );

    if (revokedCurrent) {
      this.clearAuthCookies(res);
    }
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

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, this.cookieOptions.access());
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, this.cookieOptions.refresh());
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE_NAME, this.cookieOptions.clearAccess());
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions.clearRefresh());
  }
}
