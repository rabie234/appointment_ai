"use server"

import { revalidatePath } from "next/cache"
import mongoose from "mongoose"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import Appointment from "@/models/Appointment"
import Doctor from "@/models/Doctor"
import DoctorLeave from "@/models/DoctorLeave"
import DoctorScheduleRequest from "@/models/DoctorScheduleRequest"
import {
    dayOfWeek,
    isValidTime,
    normalizeWeek,
    slotsForDay,
} from "@/lib/schedule"

export async function cancelPendingAppointment(appointmentId: string) {
    try {
        const session = await requireRole("patient")

        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return {
                success: false,
                message: "Invalid appointment",
            }
        }

        await connectDB()

        const appointment = await Appointment.findOneAndUpdate(
            {
                _id: appointmentId,
                patient: session.user.id,
                status: "pending",
            },
            {
                $set: {
                    status: "cancelled",
                    cancellationReason: "Cancelled by you",
                },
                $unset: {
                    scheduleChangeRequestId: "",
                },
            },
            { new: true }
        )

        if (!appointment) {
            return {
                success: false,
                message: "Appointment cannot be cancelled",
            }
        }

        revalidatePath("/appointments")
        revalidatePath("/admin/schedule-requests")

        return {
            success: true,
            message: "Cancelled by you",
        }
    } catch (error) {
        console.error("Failed to cancel appointment:", error)

        return {
            success: false,
            message: "Cancellation failed",
        }
    }
}

/**
 * Allows the patient to cancel an appointment affected by doctor leave
 * or a pending working-hours change.
 */
export async function cancelLeaveConflictAppointment(
    appointmentId: string
) {
    try {
        const session = await requireRole("patient")

        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return { success: false, message: "Invalid appointment" }
        }

        await connectDB()

        const appointment = await Appointment.findOneAndUpdate(
            {
                _id: appointmentId,
                patient: session.user.id,
                status: { $in: ["pending", "confirmed"] },
                $or: [
                    { leaveConflict: true },
                    {
                        scheduleChangeRequestId: {
                            $exists: true,
                            $ne: null,
                        },
                    },
                ],
            },
            {
                $set: {
                    status: "cancelled",
                    cancellationReason: "Cancelled by you",
                    leaveConflict: false,
                },
                $unset: {
                    scheduleChangeRequestId: "",
                },
            },
            { new: true }
        )

        if (!appointment) {
            return {
                success: false,
                message:
                    "This appointment cannot be cancelled or no longer needs attention.",
            }
        }

        revalidatePath("/appointments")
        revalidatePath("/admin/schedule-requests")

        return {
            success: true,
            message: "Appointment cancelled",
        }
    } catch (error) {
        console.error("Failed to cancel affected appointment:", error)

        return {
            success: false,
            message: "Cancellation failed",
        }
    }
}

/**
 * Reschedules an appointment affected by doctor leave or a pending
 * working-hours change. For a working-hours change, the new time must fit
 * the doctor's proposed schedule.
 */
export async function rescheduleLeaveConflictAppointment(
    appointmentId: string,
    dateStr: string,
    time: string
) {
    try {
        const session = await requireRole("patient")

        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return { success: false, message: "Invalid appointment" }
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return { success: false, message: "Invalid date" }
        }

        const date = new Date(`${dateStr}T00:00:00.000Z`)

        if (
            Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== dateStr
        ) {
            return { success: false, message: "Invalid date" }
        }

        if (!isValidTime(time)) {
            return { success: false, message: "Invalid time" }
        }

        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)

        if (date < today) {
            return {
                success: false,
                message: "That date has already passed",
            }
        }

        await connectDB()

        const appointment = await Appointment.findOne({
            _id: appointmentId,
            patient: session.user.id,
            status: { $in: ["pending", "confirmed"] },
            $or: [
                { leaveConflict: true },
                {
                    scheduleChangeRequestId: {
                        $exists: true,
                        $ne: null,
                    },
                },
            ],
        })

        if (!appointment) {
            return {
                success: false,
                message: "Appointment not found or no longer needs rescheduling",
            }
        }

        const doctor = await Doctor.findById(appointment.doctor)
            .select("schedule status")
            .lean()

        if (!doctor || doctor.status !== "active") {
            return {
                success: false,
                message: "This doctor is not accepting appointments",
            }
        }

        let schedule = normalizeWeek(doctor.schedule)

        if (appointment.scheduleChangeRequestId) {
            const scheduleRequest = await DoctorScheduleRequest.findOne({
                _id: appointment.scheduleChangeRequestId,
                doctor: appointment.doctor,
                status: "pending",
            })
                .select("requestedSchedule")
                .lean()

            if (!scheduleRequest) {
                return {
                    success: false,
                    message: "The schedule-change request is no longer active.",
                }
            }

            schedule = normalizeWeek(scheduleRequest.requestedSchedule)
        }

        const start = new Date(date)
        start.setUTCHours(0, 0, 0, 0)

        const end = new Date(start)
        end.setUTCDate(end.getUTCDate() + 1)

        const leave = await DoctorLeave.findOne({
            doctor: appointment.doctor,
            startDate: { $lt: end },
            endDate: { $gt: start },
            $or: [
                { status: "approved" },
                { status: { $exists: false } },
            ],
        })
            .select("_id")
            .lean()

        if (leave) {
            return {
                success: false,
                message:
                    "The doctor is on leave on this date. Choose another date.",
            }
        }

        const day = dayOfWeek(date)
        const entry = schedule.find((item) => item.day === day)

        if (!entry || entry.closed || !slotsForDay(entry).includes(time)) {
            return {
                success: false,
                message: "The doctor is not available at that time",
            }
        }

        const existing = await Appointment.find({
            doctor: appointment.doctor,
            date: { $gte: start, $lt: end },
            status: { $ne: "cancelled" },
            _id: { $ne: appointment._id },
        })
            .select("time")
            .lean()

        if (existing.some((item) => item.time === time)) {
            return {
                success: false,
                message:
                    "That slot was just taken. Please choose another time.",
            }
        }

        appointment.date = date
        appointment.time = time
        appointment.leaveConflict = false
        appointment.scheduleChangeRequestId = undefined
        await appointment.save()

        revalidatePath("/appointments")
        revalidatePath("/admin/appointments")
        revalidatePath("/admin/schedule-requests")

        return {
            success: true,
            message: "Appointment rescheduled successfully",
        }
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000
        ) {
            return {
                success: false,
                message:
                    "That slot was just taken. Please choose another time.",
            }
        }

        console.error("Failed to reschedule affected appointment:", error)

        return {
            success: false,
            message: "Rescheduling failed",
        }
    }
}