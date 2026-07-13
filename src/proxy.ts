import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { homeFor, isPublicRoute, roleForRoute } from '@/lib/roles';
import type { Role } from '@/lib/roles';

// Next.js 16 renamed the `middleware` convention to `proxy`; this file is the
// replacement for src/middleware.ts.
//
// Built from the Edge-safe config only — importing `@/lib/auth` here would pull
// Mongoose and bcrypt into the Edge runtime and fail to build.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const role = req.auth?.user?.role as Role | undefined;
  const isLoggedIn = Boolean(role);

  // Signed-in users have no business on the login/register pages.
  if (isPublicRoute(pathname)) {
    return isLoggedIn
      ? NextResponse.redirect(new URL(homeFor(role!), nextUrl))
      : NextResponse.next();
  }

  // Deny by default: every non-public route requires a session. Preserve the
  // destination so login can send them back where they were headed.
  if (!isLoggedIn) {
    const loginUrl = new URL('/auth/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in, but in the other role's area — send them to their own home.
  if (role !== roleForRoute(pathname)) {
    return NextResponse.redirect(new URL(homeFor(role!), nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Skip Next internals, static assets, and /api/auth/* (NextAuth's own
  // endpoints must stay reachable while signed out or login can't work).
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
