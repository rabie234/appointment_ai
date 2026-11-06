import type { BookingSuggestion } from "@/app/(patient)/ai-chat/tools";
import connectDB from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import Doctor from "@/models/Doctor";

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
