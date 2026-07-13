/**
 * Creates (or promotes) the admin account. Admins are intentionally NOT
 * creatable through public signup — see src/app/api/auth/register/route.ts.
 *
 *   ADMIN_EMAIL=you@clinic.com ADMIN_PASSWORD=... ADMIN_NAME="Jane" \
 *     npm run seed:admin
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';
  const uri = process.env.MONGODB_URI;

  if (!uri) throw new Error('MONGODB_URI is not set');
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }
  if (password.length < 6) {
    throw new Error('ADMIN_PASSWORD must be at least 6 characters');
  }

  await mongoose.connect(uri);

  const existing = await User.findOne({ email });

  if (existing) {
    // Promote + reset password, so this script is safe to re-run.
    existing.name = name;
    existing.role = 'admin';
    existing.password = password; // hashed by the pre-save hook
    await existing.save();
    console.log(`Promoted existing user to admin: ${email}`);
  } else {
    await User.create({ name, email, password, role: 'admin' });
    console.log(`Created admin: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
