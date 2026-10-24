'use server';

import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/mongodb';
import { requireRole } from '@/lib/session';
import User from '@/models/User';
import Appointment from '@/models/Appointment';
import Conversation from '@/models/Conversation';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 6;

export type PatientFormState = { error?: string; success?: boolean };

/**
 * Every mutation here re-asserts the admin role server-side and only ever
 * touches users whose role is `patient` — an admin account can never be
 * edited or deleted through this surface, even with a crafted id.
 */

function readPatientForm(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    phone: String(formData.get('phone') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  };
}

export async function createPatient(
  _prev: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  await requireRole('admin');

  const { name, email, phone, password } = readPatientForm(formData);

  if (!name || !email || !password) {
    return { error: 'Name, email and password are required' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Please provide a valid email' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }

  await connectDB();

  if (await User.exists({ email })) {
    return { error: 'An account with this email already exists' };
  }

  try {
    // Password is hashed by the User schema's pre-save hook.
    await User.create({
      name,
      email,
      phone: phone || undefined,
      password,
      role: 'patient',
    });
  } catch (error) {
    console.error('Create patient failed:', error);
    return { error: 'Could not create patient. Please try again.' };
  }

  revalidatePath('/admin/patients');
  return { success: true };
}

/**
 * Update a patient's profile. The password field is optional here: leaving it
 * blank keeps the current password, filling it in resets it.
 */
export async function updatePatient(
  _prev: PatientFormState,
  formData: FormData
): Promise<PatientFormState> {
  await requireRole('admin');

  const id = String(formData.get('id') ?? '');
  const { name, email, phone, password } = readPatientForm(formData);

  if (!id) return { error: 'Missing patient id' };
  if (!name || !email) {
    return { error: 'Name and email are required' };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Please provide a valid email' };
  }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }

  await connectDB();

  // Emails are unique across all users, not just patients.
  const clash = await User.exists({ email, _id: { $ne: id } });
  if (clash) {
    return { error: 'Another account already uses this email' };
  }

  try {
    const patient = await User.findOne({ _id: id, role: 'patient' });
    if (!patient) return { error: 'Patient not found' };

    patient.name = name;
    patient.email = email;
    patient.phone = phone || undefined;
    // Assigning through the document (not findByIdAndUpdate) so the pre-save
    // hook hashes the new password.
    if (password) patient.password = password;

    await patient.save();
  } catch (error) {
    console.error('Update patient failed:', error);
    return { error: 'Could not update patient. Please try again.' };
  }

  revalidatePath('/admin/patients');
  revalidatePath('/admin/appointments');
  return { success: true };
}

/**
 * Delete a patient along with their appointment history and AI conversations.
 * Refused while the patient still has a visit that is booked or underway —
 * those must be cancelled or completed first so no doctor is left with a
 * slot for a patient who no longer exists.
 */
export async function deletePatient(id: string): Promise<PatientFormState> {
  await requireRole('admin');

  if (!id) return { error: 'Missing patient id' };

  await connectDB();

  const patient = await User.findOne({ _id: id, role: 'patient' }).select('_id').lean();
  if (!patient) return { error: 'Patient not found' };

  const active = await Appointment.countDocuments({
    patient: id,
    status: { $in: ['pending', 'confirmed', 'in-progress'] },
  });
  if (active > 0) {
    return {
      error: `This patient has ${active} active appointment${active === 1 ? '' : 's'}. Cancel or complete ${active === 1 ? 'it' : 'them'} before deleting.`,
    };
  }

  try {
    await Promise.all([
      Appointment.deleteMany({ patient: id }),
      Conversation.deleteMany({ patient: id }),
    ]);
    await User.deleteOne({ _id: id, role: 'patient' });
  } catch (error) {
    console.error('Delete patient failed:', error);
    return { error: 'Could not delete patient. Please try again.' };
  }

  revalidatePath('/admin/patients');
  revalidatePath('/admin/appointments');
  return { success: true };
}
