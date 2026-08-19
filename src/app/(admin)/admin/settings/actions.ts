'use server';

import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/mongodb';
import { requireRole } from '@/lib/session';
import ClinicHours from '@/models/ClinicHours';
import { validateWeek, weekFromFormData } from '@/lib/schedule';

export type ClinicHoursState = { error?: string; success?: boolean };

/**
 * Persist the clinic's weekly opening hours into the singleton document.
 * Re-asserts the admin role server-side — server actions bypass middleware.
 */
export async function updateClinicHours(
  _prev: ClinicHoursState,
  formData: FormData
): Promise<ClinicHoursState> {
  await requireRole('admin');

  const week = weekFromFormData(formData, 'clinic');
  const check = validateWeek(week);
  if (!check.ok) return { error: check.error };

  await connectDB();

  try {
    await ClinicHours.findOneAndUpdate(
      { key: 'clinic' },
      { key: 'clinic', hours: week },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error('Update clinic hours failed:', error);
    return { error: 'Could not save clinic hours. Please try again.' };
  }

  revalidatePath('/admin/settings');
  // Doctor hours are bounded by clinic hours, so their editor reads these too.
  revalidatePath('/admin/doctors');
  return { success: true };
}
