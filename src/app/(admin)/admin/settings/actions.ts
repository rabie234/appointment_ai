
'use server';

import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/mongodb';
import { requireRole } from '@/lib/session';
import ClinicHours from '@/models/ClinicHours';
import Appointment from '@/models/Appointment';
import Doctor from '@/models/Doctor';
import {
  validateWeek,
  weekFromFormData,
  dayOfWeek,
  slotsForDay,
} from '@/lib/schedule';
import { notifyAppointmentParties } from '@/lib/notification-service';

export type ClinicHoursState = { error?: string; success?: boolean };

/**
 * Persist the clinic's weekly opening hours and detect
 * future appointments affected by the new clinic hours.
 */
export async function updateClinicHours(
  _prev: ClinicHoursState,
  formData: FormData
): Promise<ClinicHoursState> {
  await requireRole('admin');

  const week = weekFromFormData(formData, 'clinic');
  const check = validateWeek(week);

  if (!check.ok) {
    return { error: check.error };
  }

  await connectDB();

  try {
    await ClinicHours.findOneAndUpdate(
      { key: 'clinic' },
      { key: 'clinic', hours: week },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Find active future appointments, including those
    // previously marked as affected.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const appointments = await Appointment.find({
      date: { $gte: today },
      status: { $in: ['pending', 'confirmed'] },
    })
      .select('_id doctor date time clinicHoursConflict')
      .lean();

    const clinicByDay = new Map(
      week.map((entry) => [entry.day, entry])
    );

    const doctorIds = [
      ...new Set(appointments.map((appointment) =>
        String(appointment.doctor)
      )),
    ];

    const doctors = await Doctor.find({
      _id: { $in: doctorIds },
    })
      .select('schedule')
      .lean();

    const doctorById = new Map(
      doctors.map((doctor) => [String(doctor._id), doctor])
    );

    const tasks = appointments.map(async (appointment) => {
      const appointmentDate = new Date(appointment.date);
      const day = dayOfWeek(appointmentDate);
      const clinicDay = clinicByDay.get(day);

      const doctor = doctorById.get(String(appointment.doctor));

      // If the doctor or clinic schedule is unavailable,
      // do not make assumptions about the appointment.
      if (!doctor || !clinicDay) {
        return;
      }

      const affected =
        clinicDay.closed ||
        !slotsForDay(clinicDay).includes(appointment.time);

      if (affected) {
        // Avoid sending duplicate notifications.
        if (appointment.clinicHoursConflict === true) {
          return;
        }

        const result = await Appointment.updateOne(
          {
            _id: appointment._id,
            clinicHoursConflict: { $ne: true },
          },
          {
            $set: { clinicHoursConflict: true },
          }
        );

        if (result.modifiedCount > 0) {
          await notifyAppointmentParties(
            String(appointment._id),
            {
              category: 'appointment',
              titleKey: 'Notification: Appointment affected by clinic hours change',
              bodyKey:
                'Notification body: Your appointment is outside the new clinic opening hours. Please reschedule it.',
              href: '/appointments',
            },
            {
              category: 'appointment',
              titleKey: 'Notification: Appointment affected by clinic hours change',
              bodyKey:
                'Notification body: An appointment on your schedule is outside the new clinic opening hours.',
              href: '/doctor/appointments',
            }
          );
        }
      } else if (appointment.clinicHoursConflict === true) {
        // Clear the conflict if the new hours make the
        // appointment valid again.
        await Appointment.updateOne(
          { _id: appointment._id, clinicHoursConflict: true },
          { $set: { clinicHoursConflict: false } }
        );
      }
    });

    await Promise.all(tasks);
  } catch (error) {
    console.error('Update clinic hours failed:', error);
    return {
      error: 'Could not save clinic hours or process affected appointments.',
    };
  }

  revalidatePath('/admin/settings');
  revalidatePath('/admin/doctors');
  revalidatePath('/admin/appointments');
  revalidatePath('/appointments');
  revalidatePath('/doctor/appointments');

  return { success: true };
}
