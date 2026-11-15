
import type { BookingSuggestion } from "@/app/(patient)/ai-chat/tools";
import connectDB from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import Doctor from "@/models/Doctor";
import { SLOT_MINUTES, toMinutes } from "@/lib/schedule";

export type ToolContext = {
  mode: "patient" | "test";
  knowledgeMode?: "draft" | "published";
  /** Only populated by the server after atomically consuming a patient-owned proposal. */
  approvedBooking?: BookingSuggestion;
};

export function bookingIsAuthorized(
  context: ToolContext,
  args: Record<string, unknown>,
): boolean {
  const approved = context.approvedBooking;
  return (
    context.mode === "patient" &&
    Boolean(approved?.proposalId) &&
    approved?.doctorId === args.doctorId &&
    approved?.date === args.date &&
    approved?.time === args.time &&
    (args.type === undefined || args.type === "in-person")
  );
}

export type ActiveSpecialtyAppointment = {
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
};

/** Find this patient's nearest active appointment in the requested specialty. */
export async function findActiveAppointmentInSpecialty(
  patientId: string,
  specialty: string,
): Promise<ActiveSpecialtyAppointment | null> {
  const specialtyName = specialty.trim();
  if (!specialtyName) return null;

  await connectDB();

  const escapedSpecialty = specialtyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const doctors = await Doctor.find({
    specialty: new RegExp("^" + escapedSpecialty + "$", "i"),
  })
    .select("_id")
    .lean();

  if (doctors.length === 0) return null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const appointments = await Appointment.find({
    patient: patientId,
    doctor: { $in: doctors.map((doctor) => doctor._id) },
    date: { $gte: today },
    status: { $in: ["pending", "confirmed", "in-progress"] },
  })
    .populate("doctor", "name specialty")
    .sort({ date: 1, time: 1 })
    .lean();

  const appointment = appointments.find((item) => item.doctor);
  if (!appointment) return null;

  const doctor = appointment.doctor as unknown as {
    name?: string;
    specialty?: string;
  };

  return {
    doctorName: doctor.name ?? "Unknown doctor",
    specialty: doctor.specialty ?? specialtyName,
    date: new Date(appointment.date).toISOString().slice(0, 10),
    time: appointment.time,
  };
}

export type PatientTimeConflict = {
  doctorName: string;
  date: string;
  time: string;
};

/**
 * Checks whether the patient already has an active appointment that overlaps
 * the requested 30-minute appointment, regardless of the doctor.
 *
 * Blocking statuses:
 * pending, confirmed, in-progress.
 *
 * Completed, cancelled and missed appointments do not block booking.
 * Adjacent appointments are allowed.
 */
export async function findPatientTimeConflict(
  patientId: string,
  date: Date,
  time: string,
  excludeAppointmentId?: string,
): Promise<PatientTimeConflict | null> {
  const requestedStart = toMinutes(time);

  if (!Number.isFinite(requestedStart)) {
    return null;
  }

  const requestedEnd = requestedStart + SLOT_MINUTES;

  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  await connectDB();

  const appointments = await Appointment.find({
    patient: patientId,
    date: {
      $gte: startOfDay,
      $lt: endOfDay,
    },
    status: {
      $in: ["pending", "confirmed", "in-progress"],
    },
    ...(excludeAppointmentId
      ? { _id: { $ne: excludeAppointmentId } }
      : {}),
  })
    .select("date time")
    .populate("doctor", "name")
    .sort({ time: 1 })
    .lean();

  for (const appointment of appointments) {
    const existingStart = toMinutes(appointment.time);

    if (!Number.isFinite(existingStart)) {
      continue;
    }

    const existingEnd = existingStart + SLOT_MINUTES;

    const overlaps =
      requestedStart < existingEnd &&
      existingStart < requestedEnd;

    if (overlaps) {
      const doctor = appointment.doctor as unknown as {
        name?: string;
      } | null;

      return {
        doctorName: doctor?.name ?? "another doctor",
        date: new Date(appointment.date).toISOString().slice(0, 10),
        time: appointment.time,
      };
    }
  }

  return null;
}
