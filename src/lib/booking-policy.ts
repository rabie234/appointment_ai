
import type { BookingSuggestion } from "@/app/(patient)/ai-chat/tools";
import mongoose, { type ClientSession } from "mongoose";
import connectDB from "@/lib/mongodb";
import Appointment, { type IAppointment } from "@/models/Appointment";
import Doctor from "@/models/Doctor";
import User from "@/models/User";
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
  session?: ClientSession,
): Promise<ActiveSpecialtyAppointment | null> {
  const specialtyName = specialty.trim();
  if (!specialtyName) return null;

  await connectDB();

  const escapedSpecialty = specialtyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let doctorQuery = Doctor.find({
    specialty: new RegExp("^" + escapedSpecialty + "$", "i"),
  })
    .select("_id");

  if (session) doctorQuery = doctorQuery.session(session);

  const doctors = await doctorQuery.lean();

  if (doctors.length === 0) return null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let appointmentQuery = Appointment.find({
    patient: patientId,
    doctor: { $in: doctors.map((doctor) => doctor._id) },
    date: { $gte: today },
    status: { $in: ["pending", "confirmed", "in-progress"] },
  })
    .populate("doctor", "name specialty")
    .sort({ date: 1, time: 1 });

  if (session) appointmentQuery = appointmentQuery.session(session);

  const appointments = await appointmentQuery.lean();

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

export type GuardedAppointmentInput = {
  patient: string | mongoose.Types.ObjectId;
  doctor: string | mongoose.Types.ObjectId;
  date: Date;
  time: string;
  type: "video" | "in-person";
  status: "pending" | "confirmed";
  price: number;
};

/**
 * Serialize operations that reserve a time for the same patient. Updating the
 * patient's version inside a Mongo transaction makes concurrent transactions
 * for that patient conflict; the driver's transaction retry then sees the
 * first booking before it makes the second overlap check.
 */
export async function withPatientBookingLock<T>(
  patientId: string,
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  await connectDB();
  const session = await mongoose.startSession();

  try {
    let result: T | undefined;

    await session.withTransaction(async () => {
      const lock = await User.updateOne(
        { _id: patientId },
        { $inc: { bookingLockVersion: 1 } },
        { session, timestamps: false },
      );

      if (lock.matchedCount !== 1) {
        throw new Error("Patient not found while securing appointment time");
      }

      result = await operation(session);
    });

    if (result === undefined) {
      throw new Error("Appointment transaction completed without a result");
    }

    return result;
  } finally {
    await session.endSession();
  }
}

/** Create an appointment only after rechecking patient overlap in the lock transaction. */
export async function createAppointmentWithPatientConflictGuard(
  input: GuardedAppointmentInput,
): Promise<
  | { appointment: IAppointment; conflict: null; specialtyConflict: null }
  | { appointment: null; conflict: PatientTimeConflict; specialtyConflict: null }
  | { appointment: null; conflict: null; specialtyConflict: ActiveSpecialtyAppointment }
> {
  const patientId = String(input.patient);

  return withPatientBookingLock(patientId, async (session) => {
    const doctor = await Doctor.findById(input.doctor)
      .select("specialty")
      .session(session)
      .lean();

    if (!doctor) throw new Error("Doctor not found while securing appointment time");

    const specialtyConflict = await findActiveAppointmentInSpecialty(
      patientId,
      doctor.specialty ?? "",
      session,
    );

    if (specialtyConflict) {
      return { appointment: null, conflict: null, specialtyConflict };
    }

    const conflict = await findPatientTimeConflict(
      patientId,
      input.date,
      input.time,
      undefined,
      session,
    );

    if (conflict) return { appointment: null, conflict, specialtyConflict: null };

    const [appointment] = await Appointment.create([input], { session });
    return { appointment, conflict: null, specialtyConflict: null };
  });
}

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
  session?: ClientSession,
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

  let query = Appointment.find({
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
    .sort({ time: 1 });

  if (session) query = query.session(session);

  const appointments = await query.lean();

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
