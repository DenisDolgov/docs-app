import { type NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE_NAME } from '@/lib/auth-config';

// Доступны без сессии: вход/регистрация и страницы по ссылкам из письма.
const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/invite',
];

// С этих страниц авторизованного пользователя уводим на главную. Ссылки из
// письма не трогаем: подтверждение почты должно сработать и в браузере, где
// сессия уже есть.
const guestOnlyRoutes = ['/login', '/register'];

export const proxy = (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(ACCESS_COOKIE_NAME);
  const isPublic =
    publicRoutes.includes(pathname) || pathname.startsWith('/public/');

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSession && guestOnlyRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
