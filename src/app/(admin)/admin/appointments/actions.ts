"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/mongodb";
import { requireRole } from "@/lib/session";
import {
  availableSlots,
  dayOfWeek,
  intersectSchedules,
  isValidTime,
  normalizeWeek,
  slotsForDay,
} from "@/lib/schedule";
import Appointment from "@/models/Appointment";
import Doctor from "@/models/Doctor";
import DoctorLeave from "@/models/DoctorLeave";
import { parseCalendarDate as parseDay } from "@/lib/date-validation";
import { notifyAppointmentParties } from "@/lib/notification-service";
import { getClinicHours } from "@/lib/clinic-hours";
import {
  applyTransition,
  type NextStatus,
} from "@/lib/appointment-transitions";

export type AppointmentActionState = {
  error?: string;
  success?: boolean;
};

async function transition(
  id: string,
  next: NextStatus,
  cancellationReason?: string
): Promise<AppointmentActionState> {
  await requireRole("admin");

  const result = await applyTransition({ id, next, cancellationReason });

  if (result.success) {
    const events = {
      confirmed: {
        patientTitle: "Notification: Appointment confirmed",
        patientBody: "Notification body: Your appointment has been confirmed.",
        doctorTitle: "Notification: Appointment confirmed",
        doctorBody:
          "Notification body: A confirmed appointment was added to your schedule.",
      },
      cancelled: {
        patientTitle: "Notification: Appointment cancelled",
        patientBody: "Notification body: Your appointment was cancelled by the clinic.",
        doctorTitle: "Notification: Appointment cancelled",
        doctorBody: "Notification body: An appointment on your schedule was cancelled.",
      },
      "in-progress": {
        patientTitle: "Notification: Visit started",
        patientBody: "Notification body: Your visit has started.",
        doctorTitle: "Notification: Visit started",
        doctorBody: "Notification body: A visit on your schedule has started.",
      },
      completed: {
        patientTitle: "Notification: Visit completed",
        patientBody: "Notification body: Your appointment was marked as completed.",
        doctorTitle: "Notification: Visit completed",
        doctorBody: "Notification body: An appointment was marked complete.",
      },
      missed: {
        patientTitle: "Notification: Appointment marked missed",
        patientBody: "Notification body: Your appointment was marked as missed.",
        doctorTitle: "Notification: Appointment marked missed",
        doctorBody: "Notification body: An appointment was marked as missed.",
      },
    } as const;

    const event = events[next as keyof typeof events];

    if (event) {
      await notifyAppointmentParties(
        id,
        {
          category: "appointment",
          titleKey: event.patientTitle,
          bodyKey: event.patientBody,
          href: "/appointments",
        },
        {
          category: "appointment",
          titleKey: event.doctorTitle,
          bodyKey: event.doctorBody,
          href: "/doctor/appointments",
        }
      );
    }

    revalidatePath("/appointments");
    revalidatePath("/admin/appointments");
    revalidatePath("/doctor/appointments");
  }

  return result;
}

export async function confirmAppointment(id: string) {
  return transition(id, "confirmed");
}

export async function startAppointment(id: string) {
  return transition(id, "in-progress");
}

export async function completeAppointment(id: string) {
  return transition(id, "completed");
}

export async function cancelAppointment(
  id: string,
  cancellationReason?: string
) {
  return transition(id, "cancelled", cancellationReason);
}

export async function markAppointmentMissed(id: string) {
  return transition(id, "missed");
}

const CONSULTATION_FEE = 120;

/** The UTC start and exclusive end of a calendar day. */
function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

/** Times already booked for a doctor on a day. */
async function bookedTimes(
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

/** True for approved leave and older records without a status field. */
async function isDoctorOnLeave(
  doctorId: string,
  date: Date
): Promise<boolean> {
  const { start, end } = dayBounds(date);

  const leave = await DoctorLeave.findOne({
    doctor: doctorId,
    startDate: { $lt: end },
    endDate: { $gt: start },
    $or: [
      { status: "approved" },
      { status: { $exists: false } },
    ],
  })
    .select("_id")
    .lean();

  return Boolean(leave);
}

export type AdminSlotsResult = {
  slots?: string[];
  error?: string;
};

export async function getDoctorSlots(
  doctorId: string,
  dateStr: string
): Promise<AdminSlotsResult> {
  await requireRole("admin");

  const date = parseDay(dateStr);
  if (!date) return { error: "Invalid date" };

  await connectDB();

  const doctor = await Doctor.findById(doctorId)
    .select("schedule status")
    .lean();

  if (!doctor) return { error: "Doctor not found" };
  if (doctor.status !== "active") return { slots: [] };

  if (await isDoctorOnLeave(doctorId, date)) {
    return { slots: [] };
  }

  const schedule = intersectSchedules(
    normalizeWeek(doctor.schedule),
    await getClinicHours()
  );
  const taken = await bookedTimes(doctorId, date);

  return { slots: availableSlots(schedule, date, taken) };
}

export async function adminCreateAppointment(
  _prev: AppointmentActionState,
  formData: FormData
): Promise<AppointmentActionState> {
  await requireRole("admin");

  const patientId = String(formData.get("patientId") ?? "");
  const doctorId = String(formData.get("doctorId") ?? "");
  const dateStr = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const type =
    String(formData.get("type") ?? "in-person") === "video"
      ? "video"
      : "in-person";

  if (!patientId || !doctorId || !dateStr || !time) {
    return {
      error: "Patient, doctor, date and time are all required",
    };
  }

  const date = parseDay(dateStr);
  if (!date) return { error: "Invalid date" };
  if (!isValidTime(time)) return { error: "Invalid time" };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (date < today) {
    return { error: "That date has already passed" };
  }

  await connectDB();

  const doctor = await Doctor.findById(doctorId)
    .select("schedule status")
    .lean();

  if (!doctor) return { error: "Doctor not found" };

  if (doctor.status !== "active") {
    return { error: "This doctor is not accepting appointments" };
  }

  if (await isDoctorOnLeave(doctorId, date)) {
    return { error: "The doctor is on leave on this date." };
  }

  const schedule = intersectSchedules(
    normalizeWeek(doctor.schedule),
    await getClinicHours()
  );
  const entry = schedule.find((item) => item.day === dayOfWeek(date));

  if (!entry || entry.closed || !slotsForDay(entry).includes(time)) {
    return { error: "The doctor is not available at that time" };
  }

  const taken = await bookedTimes(doctorId, date);

  if (taken.has(time)) {
    return {
      error: "That slot is already taken. Please pick another time.",
    };
  }

  let appointmentId = "";

  try {
    const appointment = await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      date,
      time,
      type,
      status: "confirmed",
      price: CONSULTATION_FEE,
    });

    appointmentId = String(appointment._id);
  } catch (error) {
    console.error("Admin create appointment failed:", error);
    return {
      error: "Could not create the appointment. Please try again.",
    };
  }

  await notifyAppointmentParties(
    appointmentId,
    {
      category: "appointment",
      titleKey: "Notification: Appointment confirmed",
      bodyKey: "Notification body: Your appointment has been confirmed.",
      href: "/appointments",
    },
    {
      category: "appointment",
      titleKey: "Notification: Appointment confirmed",
      bodyKey:
        "Notification body: A confirmed appointment was added to your schedule.",
      href: "/doctor/appointments",
    }
  );

  revalidatePath("/admin/appointments");
  return { success: true };
}