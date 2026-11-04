"use server"

import { revalidatePath } from "next/cache"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import {
  availableSlots,
  dayOfWeek,
  isValidTime,
  normalizeWeek,
  slotsForDay,
} from "@/lib/schedule"
import Appointment from "@/models/Appointment"
import Doctor from "@/models/Doctor"
import DoctorLeave from "@/models/DoctorLeave"
import { parseCalendarDate as parseDay } from "@/lib/date-validation"
import {
  applyTransition,
  type NextStatus,
} from "@/lib/appointment-transitions"

export type AppointmentActionState = {
  error?: string
  success?: boolean
}

async function transition(
  id: string,
  next: NextStatus,
  cancellationReason?: string,
): Promise<AppointmentActionState> {
  await requireRole("admin")

  const result = await applyTransition({ id, next, cancellationReason })

  if (result.success) {
    revalidatePath("/appointments")
    revalidatePath("/admin/appointments")
    revalidatePath("/doctor/appointments")
  }

  return result
}

export async function confirmAppointment(id: string) {
  return transition(id, "confirmed")
}

/** Patient has arrived — start the visit (records startedAt). */
export async function startAppointment(id: string) {
  return transition(id, "in-progress")
}

/** Patient has left — complete the visit (records completedAt). */
export async function completeAppointment(id: string) {
  return transition(id, "completed")
}

export async function cancelAppointment(
  id: string,
  cancellationReason?: string,
) {
  return transition(id, "cancelled", cancellationReason)
}

export async function markAppointmentMissed(id: string) {
  return transition(id, "missed")
}

// Admin-created appointments

const CONSULTATION_FEE = 120

/** The UTC start and exclusive end of a calendar day. */
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

/** True for approved leave and older records without a status field. */
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

export type AdminSlotsResult = {
  slots?: string[]
  error?: string
}

/** Free slots for a doctor on a date — Admin booking screen. */
export async function getDoctorSlots(
  doctorId: string,
  dateStr: string,
): Promise<AdminSlotsResult> {
  await requireRole("admin")

  const date = parseDay(dateStr)
  if (!date) return { error: "Invalid date" }

  await connectDB()

  const doctor = await Doctor.findById(doctorId)
    .select("schedule status")
    .lean()

  if (!doctor) return { error: "Doctor not found" }
  if (doctor.status !== "active") return { slots: [] }

  if (await isDoctorOnLeave(doctorId, date)) {
    return { slots: [] }
  }

  const schedule = normalizeWeek(doctor.schedule)
  const taken = await bookedTimes(doctorId, date)

  return { slots: availableSlots(schedule, date, taken) }
}

/**
 * Creates an appointment for a patient after checking the doctor,
 * date, schedule, leave, and slot availability on the server.
 */
export async function adminCreateAppointment(
  _prev: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  await requireRole("admin")

  const patientId = String(formData.get("patientId") ?? "")
  const doctorId = String(formData.get("doctorId") ?? "")
  const dateStr = String(formData.get("date") ?? "")
  const time = String(formData.get("time") ?? "")
  const type =
    String(formData.get("type") ?? "in-person") === "video"
      ? "video"
      : "in-person"

  if (!patientId || !doctorId || !dateStr || !time) {
    return {
      error: "Patient, doctor, date and time are all required",
    }
  }

  const date = parseDay(dateStr)
  if (!date) return { error: "Invalid date" }
  if (!isValidTime(time)) return { error: "Invalid time" }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  if (date < today) {
    return { error: "That date has already passed" }
  }

  await connectDB()

  const doctor = await Doctor.findById(doctorId)
    .select("schedule status")
    .lean()

  if (!doctor) return { error: "Doctor not found" }

  if (doctor.status !== "active") {
    return { error: "This doctor is not accepting appointments" }
  }

  if (await isDoctorOnLeave(doctorId, date)) {
    return { error: "The doctor is on leave on this date." }
  }

  const schedule = normalizeWeek(doctor.schedule)
  const entry = schedule.find((item) => item.day === dayOfWeek(date))

  if (!entry || entry.closed || !slotsForDay(entry).includes(time)) {
    return { error: "The doctor is not available at that time" }
  }

  const taken = await bookedTimes(doctorId, date)

  if (taken.has(time)) {
    return {
      error: "That slot is already taken. Please pick another time.",
    }
  }

  try {
    await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      date,
      time,
      type,
      // Admin-created bookings are confirmed straight away.
      status: "confirmed",
      price: CONSULTATION_FEE,
    })
  } catch (error) {
    console.error("Admin create appointment failed:", error)
    return {
      error: "Could not create the appointment. Please try again.",
    }
  }

  revalidatePath("/admin/appointments")
  return { success: true }
}