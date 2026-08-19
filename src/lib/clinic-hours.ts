import connectDB from '@/lib/mongodb';
import ClinicHours from '@/models/ClinicHours';
import { normalizeWeek, type DayHours } from '@/lib/schedule';

/**
 * Load the clinic's weekly hours, always as a complete, ordered week. If the
 * singleton has never been saved, this returns the sensible default rather than
 * null, so every caller can assume seven well-formed days.
 *
 * Assumes connectDB() has already run in the calling server context — the
 * doctor actions and settings page both connect before calling this.
 */
export async function getClinicHours(): Promise<DayHours[]> {
  await connectDB();
  const doc = await ClinicHours.findOne({ key: 'clinic' }).lean();
  return normalizeWeek(doc?.hours);
}
