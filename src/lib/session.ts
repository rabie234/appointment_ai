import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { auth } from './auth';
import { homeFor, type Role } from './roles';

/**
 * Server-side guards for layouts, pages, and route handlers.
 *
 * Middleware is the first line of defence, but it is not the only one: it can
 * be bypassed by misconfigured matchers and it never runs for direct server
 * actions. Every protected surface should re-assert its own requirement here.
 */

type AuthedSession = Session & { user: NonNullable<Session['user']> };

/** Require any signed-in user. Redirects to login otherwise. */
export async function requireSession(): Promise<AuthedSession> {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login');
  }

  return session as AuthedSession;
}

/**
 * Require a signed-in user holding `role`. A signed-in user with the *other*
 * role is sent to their own home rather than to the login page — bouncing an
 * authenticated admin to a login form they've already satisfied is a dead end.
 */
export async function requireRole(role: Role): Promise<AuthedSession> {
  const session = await requireSession();

  if (session.user.role !== role) {
    redirect(homeFor(session.user.role));
  }

  return session;
}
