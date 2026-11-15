
import { isValidObjectId } from "mongoose";
import connectDB from "@/lib/mongodb";
import { isPastClinicSlot } from "@/lib/slots-server";
import Appointment, { type IAppointment } from "@/models/Appointment";
import { findPatientTimeConflict } from "@/lib/booking-policy";

export type Status = IAppointment["status"];
export type NextStatus =
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "missed";

/**
 * The statuses staff may set, and which current states each may come from.
 * Guards against nonsensical transitions.
 */
export const TRANSITIONS: Record<NextStatus, Status[]> = {
  confirmed: ["pending"],
  "in-progress": ["confirmed"],
  completed: ["in-progress"],
  cancelled: ["pending", "confirmed"],
  missed: ["confirmed"],
};

/** Keep the shared helper for schedule-request pages, using clinic-local time. */
export function appointmentHasPassed(date: Date, time: string): boolean {
  return isPastClinicSlot(date.toISOString().slice(0, 10), time);
}

/**
 * Move one appointment to its next status.
 * The caller must already have authorised the user.
 */
export async function applyTransition(options: {
  id: string;
  next: NextStatus;
  cancellationReason?: string;
  doctorId?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const { id, next, cancellationReason, doctorId } = options;

  if (!id || !isValidObjectId(id)) {
    return { error: "Missing appointment id" };
  }

  await connectDB();

  const appt = await Appointment.findOne({
    _id: id,
    ...(doctorId ? { doctor: doctorId } : {}),
  }).select(
    "patient status startedAt completedAt date time leaveConflict clinicHoursConflict scheduleChangeRequestId",
  );

  if (!appt) {
    return { error: "Appointment not found" };
  }

  if (
    (next === "confirmed" || next === "in-progress") &&
    (appt.leaveConflict ||
      appt.clinicHoursConflict ||
      appt.scheduleChangeRequestId)
  ) {
    return {
      error:
        "Resolve the schedule conflict before confirming or starting this appointment.",
    };
  }

  if (!TRANSITIONS[next].includes(appt.status)) {
    return {
      error: `Cannot move a ${appt.status} appointment to ${next}`,
    };
  }

  const scheduledDate = appt.date.toISOString().slice(0, 10);
  const scheduledStartPassed = isPastClinicSlot(
    scheduledDate,
    appt.time,
  );

  if (next === "confirmed" && scheduledStartPassed) {
    return {
      error: "This request cannot be confirmed after its scheduled time.",
    };
  }

  if (next === "missed" && !scheduledStartPassed) {
    return {
      error: "This appointment time has not passed yet.",
    };
  }

  if (
    (next === "in-progress" || next === "completed") &&
    !scheduledStartPassed
  ) {
    return {
      error: "This appointment cannot be started or completed before its scheduled time.",
    };
  }

  // Before confirming, ensure this patient has no overlapping active
  // appointment with another doctor (or the same doctor).
  if (next === "confirmed") {
    const patientTimeConflict = await findPatientTimeConflict(
      String(appt.patient),
      appt.date,
      appt.time,
      String(appt._id),
    );

    if (patientTimeConflict) {
      return {
        error:
          `Cannot confirm this appointment: the patient already has an active appointment ` +
          `with Dr. ${patientTimeConflict.doctorName} on ${patientTimeConflict.date} ` +
          `at ${patientTimeConflict.time}.`,
      };
    }
  }

  try {
    const set: Record<string, unknown> = { status: next };
    const unset: Record<string, ""> = {};

    if (next === "in-progress") {
      set.startedAt = new Date();
    }

    if (next === "completed") {
      set.completedAt = new Date();
    }

    if (next === "cancelled") {
      const reason = cancellationReason?.trim();

      if (reason) {
        set.cancellationReason = reason;
      } else {
        unset.cancellationReason = "";
      }
    }

    const updated = await Appointment.findOneAndUpdate(
      {
        _id: id,
        ...(doctorId ? { doctor: doctorId } : {}),
        status: appt.status,
        date: appt.date,
        time: appt.time,
      },
      {
        $set: set,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return {
        error:
          "This appointment changed while it was being updated. Refresh and try again.",
      };
    }
  } catch (error) {
    console.error(`Set appointment ${next} failed:`, error);

    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update the appointment. Please try again.",
    };
  }

  return { success: true };
}
