import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe slice of the auth config.
 *
 * The middleware runs on the Edge runtime, which cannot load Mongoose or
 * bcrypt. So this file deliberately contains NO database imports and NO
 * providers — only the callbacks and page config needed to read and shape the
 * JWT. `auth.ts` spreads this and adds the Credentials provider on top.
 */
export const authConfig = {
  providers: [],
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    // Persist id/role onto the token at sign-in so middleware can authorize
    // without a database round-trip.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
