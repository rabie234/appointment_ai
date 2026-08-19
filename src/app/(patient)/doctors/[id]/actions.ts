'use server';

import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/mongodb';
import { requireRole } from '@/lib/session';
import {
  availableSlots,
  isValidTime,
  normalizeWeek,
  slotsForDay,
  dayOfWeek,
} from '@/lib/schedule';
import Doctor from '@/models/Doctor';
import Appointment from '@/models/Appointment';

/** Parse a "YYYY-MM-DD" value into a UTC date at midnight. null if malformed. */
function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The [start, end) UTC bounds of the given day, for querying appointments. */
function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** The "HH:MM" times already booked for a doctor on a given day (any active status). */
async function bookedTimes(doctorId: string, date: Date): Promise<Set<string>> {
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

export type SlotsResult = { slots?: string[]; error?: string };

/**
 * Free slots for a doctor on a date. Read-only, but still requires a signed-in
 * patient — slot availability shouldn't leak to the public.
 */
export async function getAvailableSlots(
  doctorId: string,
  dateStr: string
): Promise<SlotsResult> {
  await requireRole('patient');

  const date = parseDay(dateStr);
  if (!date) return { error: 'Invalid date' };

  await connectDB();

  const doctor = await Doctor.findById(doctorId).select('schedule status').lean();
  if (!doctor) return { error: 'Doctor not found' };
  if (doctor.status !== 'active') return { slots: [] };

  const schedule = normalizeWeek(doctor.schedule);
  const taken = await bookedTimes(doctorId, date);
  return { slots: availableSlots(schedule, date, taken) };
}

export type BookingState = { error?: string; success?: boolean };

const CONSULTATION_FEE = 120;

/**
 * Book an appointment. Everything the client sends is re-validated here: the
 * doctor exists and is active, the date/time falls inside the doctor's working
 * hours for that weekday, and the slot is still free. The final guard against a
 * double-book is the unique-ish (doctor, date, time) check right before create.
 */
export async function bookAppointment(
  _prev: BookingState,
  formData: FormData
): Promise<BookingState> {
  const session = await requireRole('patient');

  const doctorId = String(formData.get('doctorId') ?? '');
  const dateStr = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  const type = String(formData.get('type') ?? 'in-person');

  if (!doctorId || !dateStr || !time) {
    return { error: 'Please choose a date and time' };
  }

  const date = parseDay(dateStr);
  if (!date) return { error: 'Invalid date' };
  if (!isValidTime(time)) return { error: 'Invalid time' };

  // No booking in the past (compare at day granularity, UTC).
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date < today) return { error: 'That date has already passed' };

  const apptType = type === 'video' ? 'video' : 'in-person';

  await connectDB();

  const doctor = await Doctor.findById(doctorId).select('schedule status').lean();
  if (!doctor) return { error: 'Doctor not found' };
  if (doctor.status !== 'active') return { error: 'This doctor is not accepting appointments' };

  // The requested time must be a real slot in the doctor's schedule for that day.
  const schedule = normalizeWeek(doctor.schedule);
  const day = dayOfWeek(date);
  const entry = schedule.find((s) => s.day === day);
  if (!entry || entry.closed || !slotsForDay(entry).includes(time)) {
    return { error: 'The doctor is not available at that time' };
  }

  // Slot must still be free.
  const taken = await bookedTimes(doctorId, date);
  if (taken.has(time)) {
    return { error: 'That slot was just taken. Please pick another time.' };
  }

  try {
    await Appointment.create({
      patient: session.user.id,
      doctor: doctorId,
      date,
      time,
      type: apptType,
      status: 'pending',
      price: CONSULTATION_FEE,
    });
  } catch (error) {
    console.error('Book appointment failed:', error);
    return { error: 'Could not book the appointment. Please try again.' };
  }

  revalidatePath('/appointments');
  return { success: true };
}
