'use server';

import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/mongodb';
import { requireDoctor } from '@/lib/doctor-session';
import { getClinicHours } from '@/lib/clinic-hours';
import { validateAgainstClinic, validateWeek, weekFromFormData } from '@/lib/schedule';
import User from '@/models/User';

export type AccountFormState = { error?: string; success?: string };

const MIN_PASSWORD_LENGTH = 6;
const NO_PROFILE: AccountFormState = { error: 'No doctor profile is linked to this account' };

function refresh() {
  revalidatePath('/doctor/account');
  revalidatePath('/admin/doctors');
  revalidatePath('/doctors');
}

/**
 * A doctor edits only their own record, resolved from the session. Email,
 * specialty and active/inactive stay admin-controlled: the email is the login
 * identity, and the others decide whether patients can book at all.
 */
export async function updateMyProfile(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const { doctor } = await requireDoctor();
  if (!doctor) return NO_PROFILE;

  const name = String(formData.get('name') ?? '').trim();
  const nameAr = String(formData.get('nameAr') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const experience = String(formData.get('experience') ?? '').trim();

  if (!name) return { error: 'Name is required' };

  try {
    doctor.name = name;
    doctor.nameAr = nameAr;
    doctor.phone = phone || undefined;
    if (experience) doctor.experience = experience;
    await doctor.save();
    // Keep the login's display details in step with the profile.
    await User.updateOne(
      { _id: doctor.user, role: 'doctor' },
      { name, phone: phone || undefined }
    );
  } catch (error) {
    console.error('Update doctor profile failed:', error);
    return { error: 'Could not save your profile. Please try again.' };
  }

  refresh();
  return { success: 'Profile saved.' };
}

/** Show yourself to patients as on leave, or as available again. */
export async function updateMyAvailability(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const { doctor } = await requireDoctor();
  if (!doctor) return NO_PROFILE;

  const availability = String(formData.get('availability') ?? '') === 'on-leave' ? 'on-leave' : 'available';

  try {
    doctor.availability = availability;
    await doctor.save();
  } catch (error) {
    console.error('Update doctor availability failed:', error);
    return { error: 'Could not update your availability. Please try again.' };
  }

  refresh();
  return { success: availability === 'on-leave' ? 'You are now shown as on leave.' : 'You are now shown as available.' };
}

/** Weekly hours, validated on their own and then bounded by the clinic's hours. */
export async function updateMySchedule(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const { doctor } = await requireDoctor();
  if (!doctor) return NO_PROFILE;

  const week = weekFromFormData(formData, 'doctor');
  const shape = validateWeek(week);
  if (!shape.ok) return { error: shape.error };

  const bounded = validateAgainstClinic(week, await getClinicHours());
  if (!bounded.ok) return { error: bounded.error };

  try {
    doctor.schedule = week;
    await doctor.save();
  } catch (error) {
    console.error('Update doctor schedule failed:', error);
    return { error: 'Could not save your working hours. Please try again.' };
  }

  refresh();
  return { success: 'Working hours saved.' };
}

export async function changeMyPassword(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const { session } = await requireDoctor();

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (!current || !next) return { error: 'Please fill in your current and new password' };
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (next !== confirm) return { error: 'New passwords do not match' };

  await connectDB();
  const user = await User.findOne({ _id: session.user.id, role: 'doctor' }).select('+password');
  if (!user || !(await user.comparePassword(current))) {
    return { error: 'Your current password is incorrect' };
  }

  try {
    user.password = next; // hashed by the pre-save hook
    await user.save();
  } catch (error) {
    console.error('Change doctor password failed:', error);
    return { error: 'Could not change your password. Please try again.' };
  }

  return { success: 'Password changed.' };
}
