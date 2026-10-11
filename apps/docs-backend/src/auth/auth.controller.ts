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
import { ApiOkResponse } from '@nestjs/swagger';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_TTL } from './auth.constants';
import { AccessTokenPayload } from './auth.models';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { loginDto } from './dto/login.dto';
import { registerDto } from './dto/register.dto';
import { userResponseDto } from './dto/user-response.dto';
import { UNAUTHORIZED_ERROR } from './errors';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body({ schema: registerDto }) body: z.infer<typeof registerDto>) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginDto }) body: z.infer<typeof loginDto>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(body);

    this.setRefreshTokenCookie(res, refreshToken);

    return {
      accessToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw new UnauthorizedException(UNAUTHORIZED_ERROR);
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);

    this.setRefreshTokenCookie(res, newRefreshToken);

    return {
      accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    this.clearRefreshTokenCookie(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await this.authService.logoutAll(refreshToken);
    }

    this.clearRefreshTokenCookie(res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SerializeOptions({ schema: userResponseDto })
  @ApiOkResponse({ standardSchema: userResponseDto })
  me(@CurrentUser() user: AccessTokenPayload) {
    return {
      email: user.email,
      id: user.sub,
    };
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

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: '/auth',
      secure: process.env.NODE_ENV === 'production',
    });
  }
}
