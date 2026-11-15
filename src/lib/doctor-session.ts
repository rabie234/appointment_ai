import connectDB from '@/lib/mongodb';
import { requireRole } from '@/lib/session';
import Doctor from '@/models/Doctor';

/**
 * Server-side guard for the doctor area. Requires a signed-in `doctor` and
 * resolves the clinic profile linked to that login. The id always comes from
 * the session, never from the client, so a doctor can only ever reach their
 * own appointments and profile. `doctor` is null if the admin removed the
 * profile but the login survived — callers must handle that.
 */
export async function requireDoctor() {
  const session = await requireRole('doctor');
  await connectDB();
  const doctor = await Doctor.findOne({ user: session.user.id });
  return { session, doctor };
}
