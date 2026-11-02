import { isValidObjectId } from 'mongoose';
import connectDB from '@/lib/mongodb';
import Appointment, { type IAppointment } from '@/models/Appointment';

export type Status = IAppointment['status'];
export type NextStatus = 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'missed';

/**
 * The statuses staff may set, and which current states each may come from.
 * Guards against nonsensical transitions (completing a visit that never
 * started, reviving a cancelled one). The visit lifecycle is
 * pending → confirmed → in-progress → completed, with cancel / missed
 * available until the visit starts.
 */
export const TRANSITIONS: Record<NextStatus, Status[]> = {
  confirmed: ['pending'],
  'in-progress': ['pending', 'confirmed'],
  completed: ['in-progress'],
  cancelled: ['pending', 'confirmed'],
  missed: ['pending', 'confirmed'],
};

/** Whether the slot's start time is already in the past. */
export function appointmentHasPassed(date: Date, time: string): boolean {
  const start = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  start.setHours(hours, minutes, 0, 0);
  return start < new Date();
}

/**
 * Move one appointment to its next status. The caller must already have
 * authorised the user; pass `doctorId` to confine the change to that doctor's
 * own appointments (the doctor area) — anything else reads as "not found".
 */
export async function applyTransition(options: {
  id: string;
  next: NextStatus;
  cancellationReason?: string;
  doctorId?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const { id, next, cancellationReason, doctorId } = options;
  if (!id || !isValidObjectId(id)) return { error: 'Missing appointment id' };

  await connectDB();

  const appt = await Appointment.findOne({
    _id: id,
    ...(doctorId ? { doctor: doctorId } : {}),
  }).select('status startedAt completedAt date time');
  if (!appt) return { error: 'Appointment not found' };

  if (!TRANSITIONS[next].includes(appt.status)) {
    return { error: `Cannot move a ${appt.status} appointment to ${next}` };
  }
  if (next === 'missed' && !appointmentHasPassed(appt.date, appt.time)) {
    return { error: 'This appointment time has not passed yet.' };
  }

  try {
    appt.status = next;
    if (next === 'in-progress') appt.startedAt = new Date();
    if (next === 'completed') appt.completedAt = new Date();
    if (next === 'cancelled') {
      appt.cancellationReason = cancellationReason?.trim() || undefined;
    }
    await appt.save();
  } catch (error) {
    console.error(`Set appointment ${next} failed:`, error);
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Could not update the appointment. Please try again.',
    };
  }
  return { success: true };
}
