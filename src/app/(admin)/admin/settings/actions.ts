
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
  intervalsForDay,
  dayOfWeek,
  slotsForDay,
} from '@/lib/schedule';
import { notifyAppointmentParties, notifyUser } from '@/lib/notification-service';

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
    const previousClinicHours = await ClinicHours.findOne({ key: 'clinic' })
      .select('hours')
      .lean();
    const daySignature = (entry: (typeof week)[number]) =>
      JSON.stringify({
        closed: entry.closed,
        intervals: entry.closed
          ? []
          : intervalsForDay(entry).map(({ open, close }) => [open, close]),
      });
    const comparableHours = (hours: typeof week) =>
      [...hours]
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((entry) => [entry.day, daySignature(entry)]);
    const clinicHoursChanged =
      !previousClinicHours ||
      JSON.stringify(comparableHours(previousClinicHours.hours)) !==
        JSON.stringify(comparableHours(week));

    const previousByDay = new Map(
      (previousClinicHours?.hours ?? []).map((entry) => [entry.day, entry])
    );
    const changedDays = week
      .filter((entry) => {
        const previous = previousByDay.get(entry.day);
        return !previous || daySignature(previous) !== daySignature(entry);
      })
      .map((entry) => entry.day);

    await ClinicHours.findOneAndUpdate(
      { key: 'clinic' },
      {
        $set: {
          key: 'clinic',
          hours: week,
          ...(clinicHoursChanged ? { lastChangedDays: changedDays } : {}),
        },
        ...(clinicHoursChanged ? { $inc: { version: 1 } } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // A clinic-closed weekday must also be marked off in every doctor's saved
    // schedule. Keep each doctor's opening/closing times so an admin can
    // restore them manually if the clinic later reopens that weekday.
    const closedDays = week.filter((entry) => entry.closed).map((entry) => entry.day);
    await Promise.all(
      closedDays.map((day) =>
        Doctor.updateMany(
          { 'schedule.day': day },
          { $set: { 'schedule.$[closedDay].closed': true } },
          { arrayFilters: [{ 'closedDay.day': day }] },
        ),
      ),
    );

    if (clinicHoursChanged) {
      const doctors = await Doctor.find({
        user: { $exists: true, $ne: null },
      })
        .select('user')
        .lean();

      await Promise.all(
        doctors.flatMap((doctor) =>
          doctor.user
            ? [
                notifyUser(String(doctor.user), {
                  category: 'schedule',
                  titleKey: 'Notification: Clinic hours updated',
                  bodyKey:
                    'Notification body: The clinic updated its working hours. Clinic-closed days are automatically marked off in your saved schedule. Review the update on your Working Hours page.',
                  href: '/doctor/working-hours',
                }),
              ]
            : []
        )
      );
    }

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
