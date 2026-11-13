import connectDB from "@/lib/mongodb";
import {
  availableSlots,
  intersectSchedules,
  normalizeWeek,
  type DayHours,
} from "@/lib/schedule";
import Doctor from "@/models/Doctor";
import Appointment from "@/models/Appointment";
import DoctorLeave from "@/models/DoctorLeave";
import { getClinicHours } from "@/lib/clinic-hours";

export const CLINIC_TIME_ZONE = "Asia/Beirut";

/** Compare a clinic-local calendar date and time with the current instant. */
export function isPastClinicSlot(
  date: string,
  time: string,
  now = new Date()
): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  const today = `${values.year}-${values.month}-${values.day}`;
  const currentTime = `${values.hour}:${values.minute}`;

  return date < today || (date === today && time <= currentTime);
}

/** Parse YYYY-MM-DD into a UTC-midnight date. */
export function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The UTC start and exclusive end of the given day. */
export function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

/** Times already booked for a doctor on a day. */
export async function bookedTimes(
  doctorId: string,
  date: Date
): Promise<Set<string>> {
  const { start, end } = dayBounds(date);

  const existing = await Appointment.find({
    doctor: doctorId,
    date: { $gte: start, $lt: end },
    status: { $ne: "cancelled" },
  })
    .select("time")
    .lean();

  return new Set(existing.map((appointment) => appointment.time));
}

export type FreeSlotsResult = {
  slots?: string[];
  error?: string;
};

/**
 * Free slots for a doctor on a date, limited to the overlap between
 * doctor hours and clinic hours. Assumes the caller checked authorization.
 */
export async function freeSlotsFor(
  doctorId: string,
  dateStr: string
): Promise<FreeSlotsResult> {
  const date = parseDay(dateStr);
  if (!date) return { error: "Invalid date" };

  await connectDB();

  const doctor = await Doctor.findById(doctorId)
    .select("schedule status")
    .lean();

  if (!doctor) return { error: "Doctor not found" };
  if (doctor.status !== "active") return { slots: [] };

  const { start, end } = dayBounds(date);

  const leave = await DoctorLeave.exists({
    doctor: doctorId,
    startDate: { $lt: end },
    endDate: { $gt: start },
    $or: [
      { status: "approved" },
      // Older admin-created leave records may have no status field.
      { status: { $exists: false } },
    ],
  });

  if (leave) return { slots: [] };

  const doctorSchedule: DayHours[] = normalizeWeek(doctor.schedule);
  const clinicSchedule = await getClinicHours();
  const effectiveSchedule = intersectSchedules(
    doctorSchedule,
    clinicSchedule
  );
  const taken = await bookedTimes(doctorId, date);

  return {
    slots: availableSlots(effectiveSchedule, date, taken).filter(
      (time) => !isPastClinicSlot(dateStr, time)
    ),
  };
}