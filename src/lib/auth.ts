import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import connectDB from './mongodb';
import User from '@/models/User';
import { authConfig } from './auth.config';
import type { Role } from './roles';

if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  throw new Error('AUTH_SECRET (or NEXTAUTH_SECRET) must be set');
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }

        await connectDB();

        // `password` is `select: false` on the schema, so it must be opted into.
        const user = await User.findOne({ email: email.toLowerCase() }).select(
          '+password'
        );

        // Return null rather than throwing: NextAuth surfaces a thrown error as
        // an opaque "CredentialsSignin" code anyway, and a null keeps the
        // "user not found" and "bad password" cases indistinguishable to the
        // client, which avoids leaking which emails are registered.
        if (!user || !(await user.comparePassword(password))) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role as Role,
        };
      },
    }),
  ],
});
