'use server';

import { revalidatePath } from 'next/cache';
import { requireDoctor } from '@/lib/doctor-session';
import { applyTransition, type NextStatus } from '@/lib/appointment-transitions';

export type DoctorAppointmentState = { error?: string; success?: boolean };

/**
 * Every action re-resolves the doctor from the session and confines the change
 * to that doctor's own appointments — an id for someone else's visit is simply
 * "not found". Server actions can be invoked directly, so this can't live only
 * in the UI.
 */
async function run(
  id: string,
  next: NextStatus,
  cancellationReason?: string
): Promise<DoctorAppointmentState> {
  const { doctor } = await requireDoctor();
  if (!doctor) return { error: 'No doctor profile is linked to this account' };

  const result = await applyTransition({
    id,
    next,
    cancellationReason,
    doctorId: String(doctor._id),
  });
  if (result.success) {
    revalidatePath('/doctor/appointments');
    revalidatePath('/admin/appointments');
    revalidatePath('/appointments');
  }
  return result;
}

export async function doctorConfirmAppointment(id: string) {
  return run(id, 'confirmed');
}

/** Patient has arrived — start the visit (records startedAt). */
export async function doctorStartAppointment(id: string) {
  return run(id, 'in-progress');
}

/** Visit finished (records completedAt). */
export async function doctorCompleteAppointment(id: string) {
  return run(id, 'completed');
}

export async function doctorCancelAppointment(id: string, cancellationReason?: string) {
  return run(id, 'cancelled', cancellationReason?.trim() || 'Cancelled by the doctor');
}

export async function doctorMarkMissed(id: string) {
  return run(id, 'missed');
}
