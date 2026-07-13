import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 6;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    // NOTE: `role` is deliberately NOT read from the request body. Accepting it
    // would let anyone self-provision an admin account by POSTing
    // {"role":"admin"}. Public signup always creates a patient; admins are
    // created out-of-band via `npm run seed:admin`.

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email' },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    await connectDB();

    if (await User.exists({ email })) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Password is hashed by the User schema's pre-save hook.
    const user = await User.create({
      name,
      email,
      password,
      role: 'patient',
    });

    return NextResponse.json(
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Never echo the raw error to the client — it can leak schema and driver
    // internals. Log it server-side instead.
    console.error('Registration failed:', error);
    return NextResponse.json(
      { error: 'Could not create account. Please try again.' },
      { status: 500 }
    );
  }
}
