'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export type LoginState = { error?: string };

/**
 * Signs the user in and redirects them onward.
 *
 * Doing this server-side means the client never has to fetch the session just
 * to learn its own role. On success `signIn` throws a Next.js redirect, which
 * must be allowed to propagate — hence the AuthError-only catch.
 *
 * We always redirect to "/" when there's no explicit callbackUrl; the
 * middleware then forwards an admin on to /admin/dashboard. That keeps the
 * role→home mapping in exactly one place instead of duplicating it here.
 */
export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const callbackUrl = String(formData.get('callbackUrl') ?? '');

  try {
    await signIn('credentials', {
      email,
      password,
      // Only relative paths are honoured, so a crafted
      // ?callbackUrl=https://evil.com can't turn login into an open redirect.
      redirectTo: isSafePath(callbackUrl) ? callbackUrl : '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.type === 'CredentialsSignin'
        ? { error: 'Invalid email or password' }
        : { error: 'Something went wrong. Please try again.' };
    }
    throw error; // redirect signal — must not be swallowed
  }

  return {};
}

function isSafePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

export type RegisterState = { error?: string };

/**
 * Creates a patient account, then signs them straight in — no bounce through
 * the login page. Role is fixed server-side; it is never taken from the form.
 */
export async function register(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!name || !email || !password) {
    return { error: 'Name, email and password are required' };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  await connectDB();

  if (await User.exists({ email })) {
    return { error: 'An account with this email already exists' };
  }

  try {
    // Password is hashed by the User schema's pre-save hook.
    await User.create({ name, email, password, role: 'patient' });
  } catch (error) {
    console.error('Registration failed:', error);
    return { error: 'Could not create account. Please try again.' };
  }

  // Throws a redirect on success.
  await signIn('credentials', { email, password, redirectTo: '/' });

  return {};
}
