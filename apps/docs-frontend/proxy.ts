import { type NextRequest, NextResponse } from 'next/server';

import { SESSION_HINT_COOKIE } from '@/lib/api';

const authRoutes = ['/login', '/register'];

// Грубый серверный гейт: по маркеру сессии пускаем, без него — на /login.
// Маркер ставит клиент (`lib/api.ts`), т.к. httpOnly refresh-cookie с
// `path=/auth` на страницах не видна. Настоящая сессия подтверждается на
// клиенте вызовом POST /auth/refresh в AuthProvider.
export const proxy = (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_HINT_COOKIE);
  const onAuthRoute = authRoutes.includes(pathname);

  if (!hasSession && !onAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSession && onAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
