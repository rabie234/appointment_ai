'use server';

import Appointment from '@/models/Appointment';
import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/mongodb';
import { requireRole } from '@/lib/session';
import { getClinicHours } from '@/lib/clinic-hours';
import { genai, GEMINI_MODEL } from '@/lib/gemini';
import {
  DAYS,
  slotsForDay,
  validateAgainstClinic,
  validateWeek,
  weekFromFormData,
} from '@/lib/schedule';
import { isPastClinicSlot } from '@/lib/slots-server';
import Doctor from '@/models/Doctor';
import User from '@/models/User';
import Specialty from '@/models/Specialty';
import { notifyAppointmentParties } from '@/lib/notification-service';
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 6;

export type DoctorFormState = { error?: string; success?: boolean };

/**
 * Every mutation here re-asserts the admin role server-side. Middleware guards
 * the /admin surface, but server actions can be invoked directly, so they must
 * defend themselves.
 */

// ── Doctors ───────────────────────────────────────────────────────────────

export async function createDoctor(
  _prev: DoctorFormState,
  formData: FormData
): Promise<DoctorFormState> {
  await requireRole('admin');

  const name = String(formData.get('name') ?? '').trim();
  const nameAr = String(formData.get('nameAr') ?? '').trim();
  const specialty = String(formData.get('specialty') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim();
  const experience = String(formData.get('experience') ?? '').trim();
  const status = String(formData.get('status') ?? 'active');
  const availability = String(formData.get('availability') ?? 'available');
  const password = String(formData.get('password') ?? '');

  if (!name || !specialty || !email) {
    return { error: 'Name, specialty and email are required' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Please provide a valid email' };
  }

  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  await connectDB();

  if (await Doctor.exists({ email })) {
    return { error: 'A doctor with this email already exists' };
  }

  if (password && (await User.exists({ email }))) {
    return { error: 'An account with this email already exists' };
  }

  let userId: string | undefined;

  try {
    if (password) {
      const user = await User.create({
        name,
        email,
        phone: phone || undefined,
        password,
        role: 'doctor',
      });
      userId = String(user._id);
    }

    await Doctor.create({
      user: userId,
      name,
      nameAr,
      specialty,
      email,
      phone: phone || undefined,
      experience: experience || undefined,
      status: status === 'inactive' ? 'inactive' : 'active',
      availability: availability === 'on-leave' ? 'on-leave' : 'available',
    });
  } catch (error) {
    console.error('Create doctor failed:', error);

    if (userId) {
      await User.deleteOne({ _id: userId }).catch(() => undefined);
    }

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
  const nameAr = String(formData.get('nameAr') ?? '').trim();
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

  const clash = await Doctor.exists({ email, _id: { $ne: id } });

  if (clash) {
    return { error: 'Another doctor already uses this email' };
  }

  const current = await Doctor.findById(id).select('user').lean();

  if (
    await User.exists({
      email,
      ...(current?.user ? { _id: { $ne: current.user } } : {}),
    })
  ) {
    return { error: 'Another account already uses this email' };
  }

  try {
    const updated = await Doctor.findByIdAndUpdate(
      id,
      {
        name,
        nameAr,
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

    if (updated.user) {
      await User.updateOne(
        { _id: updated.user, role: 'doctor' },
        { name, email, phone: phone || undefined }
      );
    }

    if (updated.status === 'inactive') {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const appointments = await Appointment.find({
        doctor: updated._id,
        date: { $gte: today },
        status: { $in: ['pending', 'confirmed'] },
      })
        .select('_id date time')
        .lean();

      const futureAppointments = appointments.filter((appointment) => {
        const dateString = new Date(appointment.date)
          .toISOString()
          .slice(0, 10);

        return !isPastClinicSlot(dateString, appointment.time);
      });

      if (futureAppointments.length > 0) {
        const appointmentIds = futureAppointments.map(
          (appointment) => appointment._id
        );

        await Appointment.updateMany(
          {
            _id: { $in: appointmentIds },
            status: { $in: ['pending', 'confirmed'] },
          },
          {
            $set: {
              status: 'cancelled',
              cancellationReason:
                'This appointment was cancelled because the doctor is no longer accepting appointments. Please contact the clinic to book another doctor.',
            },
          }
        );

        await Promise.all(
          futureAppointments.map((appointment) =>
            notifyAppointmentParties(
              String(appointment._id),
              {
                category: 'appointment',
                titleKey: 'Notification: Appointment cancelled',
                bodyKey:
                  'Notification body: Your appointment was cancelled by the clinic.',
                href: '/appointments',
              },
              {
                category: 'appointment',
                titleKey: 'Notification: Appointment cancelled',
                bodyKey:
                  'Notification body: An appointment on your schedule was cancelled.',
                href: '/doctor/appointments',
              }
            )
          )
        );
      }
    }
  } catch (error) {
    console.error('Update doctor failed:', error);
    return { error: 'Could not update doctor. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  revalidatePath('/admin/appointments');
  revalidatePath('/appointments');
  revalidatePath('/doctor/appointments');

  return { success: true };
}

export async function deleteDoctor(id: string): Promise<DoctorFormState> {
  await requireRole('admin');

  if (!id) return { error: 'Missing doctor id' };

  await connectDB();

  try {
    const deleted = await Doctor.findByIdAndDelete(id);

    if (!deleted) return { error: 'Doctor not found' };

    if (deleted.user) {
      await User.deleteOne({ _id: deleted.user, role: 'doctor' });
    }
  } catch (error) {
    console.error('Delete doctor failed:', error);
    return { error: 'Could not delete doctor. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  return { success: true };
}

/**
 * Save a doctor's weekly schedule only when:
 * - every time range is valid,
 * - every time range fits within clinic hours,
 * - no future pending or confirmed appointment falls outside the new schedule.
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

  const doctor = await Doctor.findById(id).select('_id').lean();

  if (!doctor) return { error: 'Doctor not found' };

  const clinic = await getClinicHours();
  const bounded = validateAgainstClinic(week, clinic);

  if (!bounded.ok) return { error: bounded.error };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const appointments = await Appointment.find({
    doctor: doctor._id,
    date: { $gte: today },
    status: { $in: ['pending', 'confirmed'] },
  })
    .select('date time')
    .lean();

  const conflictingAppointments = appointments.filter((appointment) => {
    const date = new Date(appointment.date);
    const dateString = date.toISOString().slice(0, 10);

    if (isPastClinicSlot(dateString, appointment.time)) {
      return false;
    }

    const day = DAYS[(date.getUTCDay() + 6) % 7];
    const requestedDay = week.find((entry) => entry.day === day);

    return (
      !requestedDay ||
      requestedDay.closed ||
      !slotsForDay(requestedDay).includes(appointment.time)
    );
  });

  if (conflictingAppointments.length > 0) {
    return {
      error:
        `This schedule conflicts with ${conflictingAppointments.length} future appointment(s). ` +
        'Resolve the affected appointments through Schedule Requests before saving.',
    };
  }

  try {
    await Doctor.findByIdAndUpdate(
      id,
      { schedule: week },
      { new: true, runValidators: true }
    );
  } catch (error) {
    console.error('Update doctor schedule failed:', error);
    return { error: 'Could not save schedule. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  revalidatePath('/admin/appointments');
  revalidatePath('/appointments');
  revalidatePath('/doctor/appointments');

  return { success: true };
}

/**
 * Give a doctor a login, or reset the password of the one they have.
 */
export async function setDoctorLogin(
  _prev: DoctorFormState,
  formData: FormData
): Promise<DoctorFormState> {
  await requireRole('admin');

  const id = String(formData.get('id') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!id) return { error: 'Missing doctor id' };

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  await connectDB();

  const doctor = await Doctor.findById(id);

  if (!doctor) return { error: 'Doctor not found' };

  try {
    const existing = doctor.user
      ? await User.findOne({ _id: doctor.user, role: 'doctor' })
      : null;

    if (existing) {
      existing.password = password;
      await existing.save();
    } else {
      if (await User.exists({ email: doctor.email })) {
        return { error: 'An account with this email already exists' };
      }

      const user = await User.create({
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone || undefined,
        password,
        role: 'doctor',
      });

      doctor.user = user._id;
      await doctor.save();
    }
  } catch (error) {
    console.error('Set doctor login failed:', error);
    return { error: 'Could not save the login. Please try again.' };
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
  const submittedNameAr = String(formData.get('nameAr') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const descriptionAr = String(formData.get('descriptionAr') ?? '').trim();

  if (!name) {
    return { error: 'Specialty name is required' };
  }

  await connectDB();

  if (await Specialty.exists({ name })) {
    return { error: 'This specialty already exists' };
  }

  try {
    let nameAr = submittedNameAr;

    if (!nameAr) {
      try {
        const result = await genai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Translate this medical specialty name into accurate Arabic.
Return only the Arabic translation, with no explanation.
Specialty: ${name}`,
        });

        nameAr = result.text?.trim() ?? '';
      } catch (error) {
        console.error('Specialty translation failed:', error);
      }
    }

    let descriptionArFinal = descriptionAr;

    if (description && !descriptionArFinal) {
      try {
        const result = await genai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Translate this medical specialty description into accurate, natural Arabic.
Return only the Arabic translation, with no explanation.
Description: ${description}`,
        });

        descriptionArFinal = result.text?.trim() ?? '';
      } catch (error) {
        console.error('Specialty description translation failed:', error);
      }
    }

    await Specialty.create({
      name,
      nameAr: nameAr || undefined,
      description: description || undefined,
      descriptionAr: descriptionArFinal || undefined,
    });
  } catch (error) {
    console.error('Create specialty failed:', error);
    return { error: 'Could not create specialty. Please try again.' };
  }

  revalidatePath('/admin/doctors');
  return { success: true };
}

export async function deleteSpecialty(
  id: string
): Promise<SpecialtyFormState> {
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