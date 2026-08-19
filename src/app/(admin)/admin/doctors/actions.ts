'use server';

import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/mongodb';
import { requireRole } from '@/lib/session';
import { getClinicHours } from '@/lib/clinic-hours';
import {
  validateAgainstClinic,
  validateWeek,
  weekFromFormData,
} from '@/lib/schedule';
import Doctor from '@/models/Doctor';
import Specialty from '@/models/Specialty';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export type DoctorFormState = { error?: string; success?: boolean };

/**
 * Every mutation here re-asserts the admin role server-side. Middleware guards
 * the /admin surface, but server actions can be invoked directly, so they must
 * defend themselves — see the note in src/lib/session.ts.
 */

// ── Doctors ───────────────────────────────────────────────────────────────

export async function createDoctor(
  _prev: DoctorFormState,
  formData: FormData
): Promise<DoctorFormState> {
  await requireRole('admin');

  const name = String(formData.get('name') ?? '').trim();
  const specialty = String(formData.get('specialty') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim();
  const experience = String(formData.get('experience') ?? '').trim();
  const status = String(formData.get('status') ?? 'active');
  const availability = String(formData.get('availability') ?? 'available');

  if (!name || !specialty || !email) {
    return { error: 'Name, specialty and email are required' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Please provide a valid email' };
  }

  await connectDB();

  if (await Doctor.exists({ email })) {
    return { error: 'A doctor with this email already exists' };
  }

  try {
    await Doctor.create({
      name,
      specialty,
      email,
      phone: phone || undefined,
      experience: experience || undefined,
      status: status === 'inactive' ? 'inactive' : 'active',
      availability: availability === 'on-leave' ? 'on-leave' : 'available',
    });
  } catch (error) {
    console.error('Create doctor failed:', error);
    return { error: 'Could not create doctor. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  return { success: true };
}

export async function updateDoctor(
  _prev: DoctorFormState,
  formData: FormData
): Promise<DoctorFormState> {
  await requireRole('admin');

  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const specialty = String(formData.get('specialty') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim();
  const experience = String(formData.get('experience') ?? '').trim();
  const status = String(formData.get('status') ?? 'active');
  const availability = String(formData.get('availability') ?? 'available');

  if (!id) return { error: 'Missing doctor id' };
  if (!name || !specialty || !email) {
    return { error: 'Name, specialty and email are required' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Please provide a valid email' };
  }

  await connectDB();

  // Guard against colliding with another doctor's email.
  const clash = await Doctor.exists({ email, _id: { $ne: id } });
  if (clash) {
    return { error: 'Another doctor already uses this email' };
  }

  try {
    const updated = await Doctor.findByIdAndUpdate(
      id,
      {
        name,
        specialty,
        email,
        phone: phone || undefined,
        experience: experience || undefined,
        status: status === 'inactive' ? 'inactive' : 'active',
        availability: availability === 'on-leave' ? 'on-leave' : 'available',
      },
      { new: true, runValidators: true }
    );
    if (!updated) return { error: 'Doctor not found' };
  } catch (error) {
    console.error('Update doctor failed:', error);
    return { error: 'Could not update doctor. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  return { success: true };
}

export async function deleteDoctor(id: string): Promise<DoctorFormState> {
  await requireRole('admin');

  if (!id) return { error: 'Missing doctor id' };

  await connectDB();

  try {
    const deleted = await Doctor.findByIdAndDelete(id);
    if (!deleted) return { error: 'Doctor not found' };
  } catch (error) {
    console.error('Delete doctor failed:', error);
    return { error: 'Could not delete doctor. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  return { success: true };
}

/**
 * Save a doctor's weekly availability. Hours are validated on their own (open <
 * close) and then bounded by the clinic's opening hours, so a doctor can never
 * be marked available when the clinic is shut — see validateAgainstClinic.
 */
export async function updateDoctorSchedule(
  _prev: DoctorFormState,
  formData: FormData
): Promise<DoctorFormState> {
  await requireRole('admin');

  const id = String(formData.get('id') ?? '');
  if (!id) return { error: 'Missing doctor id' };

  const week = weekFromFormData(formData, 'doctor');

  const shape = validateWeek(week);
  if (!shape.ok) return { error: shape.error };

  await connectDB();

  const clinic = await getClinicHours();
  const bounded = validateAgainstClinic(week, clinic);
  if (!bounded.ok) return { error: bounded.error };

  try {
    const updated = await Doctor.findByIdAndUpdate(
      id,
      { schedule: week },
      { new: true, runValidators: true }
    );
    if (!updated) return { error: 'Doctor not found' };
  } catch (error) {
    console.error('Update doctor schedule failed:', error);
    return { error: 'Could not save schedule. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  return { success: true };
}

// ── Specialties ─────────────────────────────────────────────────────────────

export type SpecialtyFormState = { error?: string; success?: boolean };

export async function createSpecialty(
  _prev: SpecialtyFormState,
  formData: FormData
): Promise<SpecialtyFormState> {
  await requireRole('admin');

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!name) return { error: 'Specialty name is required' };

  await connectDB();

  if (await Specialty.exists({ name })) {
    return { error: 'This specialty already exists' };
  }

  try {
    await Specialty.create({ name, description: description || undefined });
  } catch (error) {
    console.error('Create specialty failed:', error);
    return { error: 'Could not create specialty. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  return { success: true };
}

export async function deleteSpecialty(id: string): Promise<SpecialtyFormState> {
  await requireRole('admin');

  if (!id) return { error: 'Missing specialty id' };

  await connectDB();

  try {
    const deleted = await Specialty.findByIdAndDelete(id);
    if (!deleted) return { error: 'Specialty not found' };
  } catch (error) {
    console.error('Delete specialty failed:', error);
    return { error: 'Could not delete specialty. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  return { success: true };
}
