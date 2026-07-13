/**
 * Single source of truth for roles and where each role is allowed to go.
 * Imported by both the middleware (Edge) and server components, so it must
 * stay free of any runtime-specific dependencies.
 */

export const ROLES = ['patient', 'admin'] as const;

export type Role = (typeof ROLES)[number];

/** Where a user lands after signing in, and where they bounce to when they
 *  wander into the other role's area. */
export const HOME_BY_ROLE: Record<Role, string> = {
  patient: '/',
  admin: '/admin/dashboard',
};

/** Routes reachable while signed out. Everything else requires a session. */
const PUBLIC_ROUTES = ['/auth/login', '/auth/register'];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/** The role that owns a given path. Patient owns everything not under /admin. */
export function roleForRoute(pathname: string): Role {
  return isAdminRoute(pathname) ? 'admin' : 'patient';
}

export function homeFor(role: Role): string {
  return HOME_BY_ROLE[role] ?? HOME_BY_ROLE.patient;
}
