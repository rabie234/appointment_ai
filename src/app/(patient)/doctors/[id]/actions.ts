"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import {
  availableSlots,
  isValidTime,
  normalizeWeek,
  slotsForDay,
  dayOfWeek,
  intersectSchedules,
} from "@/lib/schedule"
import Doctor from "@/models/Doctor"
import Appointment from "@/models/Appointment"
import DoctorLeave from "@/models/DoctorLeave"
import { parseCalendarDate as parseDay } from "@/lib/date-validation"
import mongoose from "mongoose"
import DoctorScheduleRequest from "@/models/DoctorScheduleRequest"
import {
  findActiveAppointmentInSpecialty,
  type ActiveSpecialtyAppointment,
} from "@/lib/booking-policy"
import { notifyAdmins, notifyUser } from "@/lib/notification-service"
import { getClinicHours } from "@/lib/clinic-hours";
/** The UTC start and exclusive end of a day. */
function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  return { start, end }
}

/** Times already booked for a doctor on a day. */
async function bookedTimes(
  doctorId: string,
  date: Date,
): Promise<Set<string>> {
  const { start, end } = dayBounds(date)

  const existing = await Appointment.find({
    doctor: doctorId,
    date: { $gte: start, $lt: end },
    status: { $ne: "cancelled" },
  })
    .select("time")
    .lean()

  return new Set(existing.map((appointment) => appointment.time))
}

/** True only for approved leave and older records that have no status field. */
async function isDoctorOnLeave(
  doctorId: string,
  date: Date,
): Promise<boolean> {
  const { start, end } = dayBounds(date)

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
    .lean()

  return Boolean(leave)
}

export type SlotsResult = {
  slots?: string[]
  error?: string
  onLeave?: boolean
}

/**
 * Gets available slots for a date. A signed-in patient is required.
 */
export async function getAvailableSlots(
  doctorId: string,
  dateStr: string,
  appointmentId?: string
): Promise<SlotsResult> {
  const session = await requireRole("patient")

  const date = parseDay(dateStr)
  if (!date) return { error: "Invalid date" }

  await connectDB()

  const doctor = await Doctor.findById(doctorId)
    .select("schedule status")
    .lean()


  if (!doctor) return { error: "Doctor not found" }
  if (doctor.status !== "active") return { slots: [] }

  if (await isDoctorOnLeave(doctorId, date)) {
    return { slots: [], onLeave: true }
  }

  let schedule = normalizeWeek(doctor.schedule)

  if (appointmentId) {
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return { slots: [], error: "Invalid appointment" }
    }
const clinicSchedule = await getClinicHours();

schedule = intersectSchedules(
  schedule,
  clinicSchedule
);
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patient: session.user.id,
      doctor: doctorId,
      status: { $in: ["pending", "confirmed"] },
    })
      .select("scheduleChangeRequestId")
      .lean()

    if (!appointment) {
      return {
        slots: [],
        error: "Appointment not found or no longer needs rescheduling",
      }
    }

    if (appointment.scheduleChangeRequestId) {
      const scheduleRequest = await DoctorScheduleRequest.findOne({
        _id: appointment.scheduleChangeRequestId,
        doctor: doctorId,
        status: "pending",
      })
        .select("requestedSchedule")
        .lean()

      if (!scheduleRequest) {
        return {
          slots: [],
          error: "The schedule-change request is no longer active.",
        }
      }

      schedule = normalizeWeek(scheduleRequest.requestedSchedule)
    }
  }

  const taken = await bookedTimes(doctorId, date)

  return { slots: availableSlots(schedule, date, taken) }
}
/** Returns only dates covered by approved leave or older status-less records. */
export async function getDoctorLeaveDates(
  doctorId: string,
  dateStrings: string[],
): Promise<string[]> {
  await requireRole("patient")
  await connectDB()

  const dates = dateStrings
    .map(parseDay)
    .filter((date): date is Date => date !== null)

  if (dates.length === 0) return []

  const firstDay = new Date(
    Math.min(...dates.map((date) => date.getTime())),
  )
  const lastDay = new Date(
    Math.max(...dates.map((date) => date.getTime())),
  )
  lastDay.setUTCDate(lastDay.getUTCDate() + 1)

  const leaves = await DoctorLeave.find({
    doctor: doctorId,
    startDate: { $lt: lastDay },
    endDate: { $gt: firstDay },
    $or: [
      { status: "approved" },
      { status: { $exists: false } },
    ],
  })
    .select("startDate endDate")
    .lean()

  return dates
    .filter((date) =>
      leaves.some((leave) => {
        const start = new Date(leave.startDate)
        const end = new Date(leave.endDate)

        start.setUTCHours(0, 0, 0, 0)
        end.setUTCHours(0, 0, 0, 0)

        return date >= start && date < end
      }),
    )
    .map((date) => date.toISOString().slice(0, 10))
}

export type BookingState = {
  error?: string
  success?: boolean
  existingAppointment?: ActiveSpecialtyAppointment
}

const CONSULTATION_FEE = 120

/**
 * Books an appointment after validating the doctor, date, schedule,
 * approved leave, and current slot availability on the server.
 */
export async function bookAppointment(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const session = await requireRole("patient")

  const doctorId = String(formData.get("doctorId") ?? "")
  const dateStr = String(formData.get("date") ?? "")
  const time = String(formData.get("time") ?? "")
  const type = String(formData.get("type") ?? "in-person")

  if (!doctorId || !dateStr || !time) {
    return { error: "Please choose a date and time" }
  }

  const date = parseDay(dateStr)
  if (!date) return { error: "Invalid date" }
  if (!isValidTime(time)) return { error: "Invalid time" }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  if (date < today) {
    return { error: "That date has already passed" }
  }

  const appointmentType = type === "video" ? "video" : "in-person"

  await connectDB()

  const doctor = await Doctor.findById(doctorId)
    .select("schedule status specialty")
    .lean()

  if (!doctor) return { error: "Doctor not found" }

  if (doctor.status !== "active") {
    return { error: "This doctor is not accepting appointments" }
  }

  const existingAppointment = await findActiveAppointmentInSpecialty(
    session.user.id,
    doctor.specialty ?? "",
  )
  if (existingAppointment) {
    return {
      error:
        "You already have an active appointment in this specialty. Finish or cancel it before booking another.",
      existingAppointment,
    }
  }

  if (await isDoctorOnLeave(doctorId, date)) {
    return {
      error: "The doctor is on leave on this date. Please choose another date.",
    }
  }

 const doctorSchedule = normalizeWeek(doctor.schedule);
const clinicSchedule = await getClinicHours();

const effectiveSchedule = intersectSchedules(
  doctorSchedule,
  clinicSchedule
);

const day = dayOfWeek(date);
const entry = effectiveSchedule.find((item) => item.day === day);

  if (!entry || entry.closed || !slotsForDay(entry).includes(time)) {
    return { error: "The doctor is not available at that time" }
  }

  const taken = await bookedTimes(doctorId, date)

  if (taken.has(time)) {
    return {
      error: "That slot was just taken. Please pick another time.",
    }
  }

  try {
    await Appointment.create({
      patient: session.user.id,
      doctor: doctorId,
      date,
      time,
      type: appointmentType,
      status: "pending",
      price: CONSULTATION_FEE,
    })
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return {
        error: "That slot was just taken. Please pick another time.",
      }
    }

    console.error("Book appointment failed:", error)

    return {
      error: "Could not book the appointment. Please try again.",
    }
  }

  const context = dateStr + " · " + time
  await Promise.all([
    notifyUser(session.user.id, {
      category: "appointment",
      titleKey: "Notification: Appointment request received",
      bodyKey: "Notification body: The clinic received your appointment request.",
      href: "/appointments",
      context,
    }),
    notifyAdmins({
      category: "appointment",
      titleKey: "Notification: New appointment request",
      bodyKey: "Notification body: A patient submitted an appointment request that needs confirmation.",
      href: "/admin/appointments",
      context,
    }),
  ])

  revalidatePath("/appointments")
  return { success: true }
}