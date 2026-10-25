import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

import { ACCESS_COOKIE_TTL, REFRESH_COOKIE_TTL } from './auth.constants';

type SameSite = NonNullable<CookieOptions['sameSite']>;

@Injectable()
export class AuthCookieOptions {
  constructor(private readonly config: ConfigService) {}

  // `__Host-` требует Secure + Path=/ и запрещает Domain: чужие настройки
  // сюда сознательно не протекают, иначе браузер отбросит куку.
  access(): CookieOptions {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_COOKIE_TTL,
    };
  }

  refresh(): CookieOptions {
    return {
      ...this.sharedRefresh(),
      path: '/auth',
      maxAge: REFRESH_COOKIE_TTL,
    };
  }

  // `clearCookie` удаляет куку только при совпадении имени и области: path,
  // domain и sameSite обязаны повторять установку.
  clearAccess(): CookieOptions {
    const { maxAge: _maxAge, ...options } = this.access();

    return options;
  }

  clearRefresh(): CookieOptions {
    const { maxAge: _maxAge, ...options } = this.refresh();

    return options;
  }

  private sharedRefresh(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('COOKIE_SECURE') ?? true,
      sameSite:
        this.config.get<SameSite>('COOKIE_SAMESITE') ?? ('strict' as const),
      domain: this.config.get<string>('COOKIE_DOMAIN') || undefined,
    };
  }
}
