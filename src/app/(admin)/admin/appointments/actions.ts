'use server';

import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/mongodb';
import { requireRole } from '@/lib/session';
import {
  availableSlots,
  dayOfWeek,
  isValidTime,
  normalizeWeek,
  slotsForDay,
} from '@/lib/schedule';
import Appointment from '@/models/Appointment';
import Doctor from '@/models/Doctor';

export type AppointmentActionState = { error?: string; success?: boolean };

type Status = 'pending' | 'confirmed' | 'completed' | 'cancelled';

// The statuses an admin is allowed to set, and which current states each may
// come from. Guards against nonsensical transitions (e.g. reviving a cancelled
// appointment into "completed").
const TRANSITIONS: Record<'confirmed' | 'completed' | 'cancelled', Status[]> = {
  confirmed: ['pending'],
  completed: ['pending', 'confirmed'],
  cancelled: ['pending', 'confirmed'],
};

async function transition(
  id: string,
  next: keyof typeof TRANSITIONS
): Promise<AppointmentActionState> {
  await requireRole('admin');
  if (!id) return { error: 'Missing appointment id' };

  await connectDB();

  const appt = await Appointment.findById(id).select('status');
  if (!appt) return { error: 'Appointment not found' };

  if (!TRANSITIONS[next].includes(appt.status)) {
    return { error: `Cannot move a ${appt.status} appointment to ${next}` };
  }

  try {
    appt.status = next;
    await appt.save();
  } catch (error) {
    console.error(`Set appointment ${next} failed:`, error);
    return { error: 'Could not update the appointment. Please try again.' };
  }

  revalidatePath('/admin/appointments');
  return { success: true };
}

export async function confirmAppointment(id: string) {
  return transition(id, 'confirmed');
}

export async function completeAppointment(id: string) {
  return transition(id, 'completed');
}

export async function cancelAppointment(id: string) {
  return transition(id, 'cancelled');
}

// ── Admin-created appointments ──────────────────────────────────────────────

const CONSULTATION_FEE = 120;

/** Parse "YYYY-MM-DD" into a UTC-midnight date. null if malformed. */
function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** "HH:MM" slots already taken (any non-cancelled status) for a doctor on a day. */
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

export type AdminSlotsResult = { slots?: string[]; error?: string };

/** Free slots for a doctor on a date — admin variant of the patient booking. */
export async function getDoctorSlots(
  doctorId: string,
  dateStr: string
): Promise<AdminSlotsResult> {
  await requireRole('admin');

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

/**
 * Create an appointment on a patient's behalf. Same server-side guards as the
 * patient flow: doctor active, time is a real slot for that weekday, date not in
 * the past, and the slot still free.
 */
export async function adminCreateAppointment(
  _prev: AppointmentActionState,
  formData: FormData
): Promise<AppointmentActionState> {
  await requireRole('admin');

  const patientId = String(formData.get('patientId') ?? '');
  const doctorId = String(formData.get('doctorId') ?? '');
  const dateStr = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  const type = String(formData.get('type') ?? 'in-person') === 'video' ? 'video' : 'in-person';

  if (!patientId || !doctorId || !dateStr || !time) {
    return { error: 'Patient, doctor, date and time are all required' };
  }

  const date = parseDay(dateStr);
  if (!date) return { error: 'Invalid date' };
  if (!isValidTime(time)) return { error: 'Invalid time' };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (date < today) return { error: 'That date has already passed' };

  await connectDB();

  const doctor = await Doctor.findById(doctorId).select('schedule status').lean();
  if (!doctor) return { error: 'Doctor not found' };
  if (doctor.status !== 'active') return { error: 'This doctor is not accepting appointments' };

  const schedule = normalizeWeek(doctor.schedule);
  const entry = schedule.find((s) => s.day === dayOfWeek(date));
  if (!entry || entry.closed || !slotsForDay(entry).includes(time)) {
    return { error: 'The doctor is not available at that time' };
  }

  const taken = await bookedTimes(doctorId, date);
  if (taken.has(time)) {
    return { error: 'That slot is already taken. Please pick another time.' };
  }

  try {
    await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      date,
      time,
      type,
      // Admin-created bookings are confirmed straight away.
      status: 'confirmed',
      price: CONSULTATION_FEE,
    });
  } catch (error) {
    console.error('Admin create appointment failed:', error);
    return { error: 'Could not create the appointment. Please try again.' };
  }

  revalidatePath('/admin/appointments');
  return { success: true };
}
