import { type NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE_NAME } from '@/lib/auth-config';

const authRoutes = ['/login', '/register'];

export const proxy = (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(ACCESS_COOKIE_NAME);
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
