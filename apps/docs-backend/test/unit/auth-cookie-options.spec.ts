import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import {
  ACCESS_COOKIE_TTL,
  REFRESH_COOKIE_TTL,
} from '../../src/auth/auth.constants';
import { AuthCookieOptions } from '../../src/auth/auth-cookie-options';

type CookieEnv = {
  COOKIE_SECURE?: boolean;
  COOKIE_SAMESITE?: string;
  COOKIE_DOMAIN?: string;
};

const createOptions = (overrides: CookieEnv = {}) => {
  const values: CookieEnv = {
    COOKIE_SECURE: true,
    COOKIE_SAMESITE: 'strict',
    COOKIE_DOMAIN: undefined,
    ...overrides,
  };

  const config = {
    get: (key: keyof CookieEnv) => values[key],
  } as unknown as ConfigService;

  return new AuthCookieOptions(config);
};

describe('AuthCookieOptions (unit)', () => {
  it('access-кука всегда Secure, Strict и без Domain', () => {
    const options = createOptions();

    expect(options.access()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_COOKIE_TTL,
    });
    // Префикс `__Host-` требует Path=/ и запрещает Domain. Эти два атрибута
    // не конфигурируются: иначе браузер отбросит куку.
    expect(options.access().domain).toBeUndefined();
  });

  it('refresh-кука по умолчанию повторяет настройки access', () => {
    const options = createOptions();

    expect(options.refresh()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: REFRESH_COOKIE_TTL,
    });
    expect(options.refresh().domain).toBeUndefined();
  });

  it('Secure, SameSite и Domain приходят из конфига', () => {
    const options = createOptions({
      COOKIE_SECURE: false,
      COOKIE_SAMESITE: 'lax',
      COOKIE_DOMAIN: 'docs.example.test',
    });

    expect(options.refresh()).toMatchObject({
      secure: false,
      sameSite: 'lax',
      domain: 'docs.example.test',
      path: '/auth',
    });
  });

  it('настройки refresh не ослабляют access-куку', () => {
    const options = createOptions({
      COOKIE_SECURE: false,
      COOKIE_SAMESITE: 'lax',
      COOKIE_DOMAIN: 'docs.example.test',
    });

    expect(options.access()).toMatchObject({
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
    expect(options.access().domain).toBeUndefined();
  });

  it('принимает SameSite=None для межсайтового фронтенда', () => {
    const options = createOptions({
      COOKIE_SAMESITE: 'none',
      COOKIE_SECURE: true,
    });

    expect(options.refresh().sameSite).toBe('none');
    expect(options.refresh().secure).toBe(true);
  });

  it('очистка повторяет path, domain и sameSite, но без maxAge', () => {
    const options = createOptions({
      COOKIE_SECURE: false,
      COOKIE_SAMESITE: 'lax',
      COOKIE_DOMAIN: 'docs.example.test',
    });

    expect(options.clearRefresh()).toMatchObject({
      path: '/auth',
      domain: 'docs.example.test',
      sameSite: 'lax',
    });
    expect(options.clearRefresh().maxAge).toBeUndefined();

    expect(options.clearAccess()).toMatchObject({
      path: '/',
      sameSite: 'strict',
    });
    expect(options.clearAccess().domain).toBeUndefined();
    expect(options.clearAccess().maxAge).toBeUndefined();
  });
});
