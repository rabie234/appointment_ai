import connectDB from '@/lib/mongodb';
import { availableSlots, normalizeWeek, type DayHours } from '@/lib/schedule';
import Doctor from '@/models/Doctor';
import Appointment from '@/models/Appointment';

/**
 * Server-side slot helpers shared by the patient booking flow, the admin
 * appointment creator, and the AI assistant tools — so the "what's free?" logic
 * lives in exactly one place.
 */

/** Parse "YYYY-MM-DD" into a UTC-midnight date. null if malformed. */
export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The [start, end) UTC bounds of the given day. */
export function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** "HH:MM" times already taken (any non-cancelled status) for a doctor on a day. */
export async function bookedTimes(doctorId: string, date: Date): Promise<Set<string>> {
  const { start, end } = dayBounds(date);
  const existing = await Appointment.find({
    doctor: doctorId,
    date: { $gte: start, $lt: end },
    status: { $ne: 'cancelled' },
  })
    .select('time')
    .lean();
  return new Set(existing.map((a) => a.time));
}

export type FreeSlotsResult = { slots?: string[]; error?: string };

/**
 * Free slots for a doctor on a "YYYY-MM-DD" date: the doctor's schedule for that
 * weekday minus already-booked times. Returns [] for an inactive doctor.
 * Assumes the caller has already asserted whatever auth it needs.
 */
export async function freeSlotsFor(
  doctorId: string,
  dateStr: string
): Promise<FreeSlotsResult> {
  const date = parseDay(dateStr);
  if (!date) return { error: 'Invalid date' };

  await connectDB();

  const doctor = await Doctor.findById(doctorId).select('schedule status').lean();
  if (!doctor) return { error: 'Doctor not found' };
  if (doctor.status !== 'active') return { slots: [] };

  const schedule: DayHours[] = normalizeWeek(doctor.schedule);
  const taken = await bookedTimes(doctorId, date);
  return { slots: availableSlots(schedule, date, taken) };
}
