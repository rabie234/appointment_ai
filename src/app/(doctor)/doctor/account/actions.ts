'use server';

import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/mongodb';
import { requireDoctor } from '@/lib/doctor-session';
import { getClinicHours } from '@/lib/clinic-hours';
import ClinicHours from '@/models/ClinicHours';
import { normalizeWeek, validateAgainstClinic, validateWeek, weekFromFormData } from '@/lib/schedule';
import User from '@/models/User';
import DoctorScheduleRequest from "@/models/DoctorScheduleRequest"
import { notifyAdmins } from "@/lib/notification-service"
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


/** Weekly hours, validated on their own and then bounded by the clinic's hours. */
export async function requestMyScheduleChange(
  _prev: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const { doctor } = await requireDoctor()
  if (!doctor) return NO_PROFILE

  const week = weekFromFormData(formData, "doctor")
  const shape = validateWeek(week)
  if (!shape.ok) return { error: shape.error }

  const bounded = validateAgainstClinic(week, await getClinicHours())
  if (!bounded.ok) return { error: bounded.error }

  await connectDB()

  const alreadyPending = await DoctorScheduleRequest.exists({
    doctor: doctor._id,
    status: "pending",
  })

  if (alreadyPending) {
    return { error: "You already have a pending schedule-change request." }
  }

  try {
    await DoctorScheduleRequest.create({
      doctor: doctor._id,
      requestedSchedule: week,
      status: "pending",
    })
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return { error: "You already have a pending schedule-change request." }
    }

    console.error("Submit doctor schedule-change request failed:", error)
    return {
      error: "Could not submit your schedule-change request. Please try again.",
    }
  }

  await notifyAdmins({
    category: "schedule",
    titleKey: "Notification: New working-hours request",
    bodyKey: "Notification body: A doctor submitted a working-hours change for review.",
    href: "/admin/schedule-requests",
  })

  revalidatePath("/doctor/account")
  revalidatePath("/doctor/working-hours")
  revalidatePath("/admin/schedule-requests")

  return {
    success: "Schedule-change request submitted for admin approval.",
  }
}
/** Record that the signed-in doctor reviewed this exact clinic-hours version. */
export async function acknowledgeClinicHours(): Promise<void> {
  const { doctor } = await requireDoctor();
  if (!doctor) return;

  await connectDB();
  const clinicHours = await ClinicHours.findOne({ key: 'clinic' })
    .select('hours createdAt version')
    .lean();
  const version = clinicHours
    ? `${new Date(clinicHours.createdAt).toISOString()}:${clinicHours.version ?? 0}`
    : 'default';

  // Reviewing this version applies the clinic's current weekly hours to the
  // doctor's saved schedule. Any later personal changes still use approval.
  doctor.schedule = normalizeWeek(clinicHours?.hours);
  doctor.clinicHoursAcknowledgedVersion = version;
  await doctor.save();
  revalidatePath('/doctor/working-hours');
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