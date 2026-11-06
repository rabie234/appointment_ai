"use server"

import { isValidObjectId } from "mongoose"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/session"
import connectDB from "@/lib/mongodb"
import Appointment from "@/models/Appointment"
import Doctor from "@/models/Doctor"
import DoctorScheduleRequest from "@/models/DoctorScheduleRequest"
import { getClinicHours } from "@/lib/clinic-hours"
import {
    DAYS,
    SLOT_MINUTES,
    normalizeWeek,
    toMinutes,
    validateAgainstClinic,
    validateWeek,
} from "@/lib/schedule"
import { appointmentHasPassed } from "@/lib/appointment-transitions"

type ScheduleReviewResult = {
    error?: string
    success?: boolean
}

function revalidateSchedulePages() {
    revalidatePath("/admin/schedule-requests")
    revalidatePath("/doctor/working-hours")
    revalidatePath("/admin/doctors")
    revalidatePath("/doctors")
    revalidatePath("/appointments")
}

export async function approveScheduleChange(
    requestId: string,
    adminNote = ""
): Promise<ScheduleReviewResult> {
    const session = await requireRole("admin")

    if (!isValidObjectId(requestId)) {
        return { error: "Invalid schedule request." }
    }

    await connectDB()

    const request = await DoctorScheduleRequest.findOne({
        _id: requestId,
        status: "pending",
    }).lean()

    if (!request) {
        return { error: "Pending schedule request not found." }
    }

    const doctor = await Doctor.findById(request.doctor)
        .select("_id")
        .lean()

    if (!doctor) {
        return { error: "Doctor not found." }
    }

    const requestedSchedule = normalizeWeek(request.requestedSchedule)
    const shape = validateWeek(requestedSchedule)

    if (!shape.ok) {
        return { error: shape.error }
    }

    const withinClinicHours = validateAgainstClinic(
        requestedSchedule,
        await getClinicHours()
    )

    if (!withinClinicHours.ok) {
        return { error: withinClinicHours.error }
    }

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const appointments = await Appointment.find({
        doctor: doctor._id,
        date: { $gte: today },
        status: { $in: ["pending", "confirmed", "in-progress"] },
    })
        .select("date time")
        .lean()

    const futureAppointments = appointments.filter(
        (appointment) =>
            !appointmentHasPassed(appointment.date, appointment.time)
    )

    const conflicts = futureAppointments.some((appointment) => {
        const date = new Date(appointment.date)
        const day = DAYS[(date.getUTCDay() + 6) % 7]
        const hours = requestedSchedule.find((item) => item.day === day)

        if (!hours || hours.closed) {
            return true
        }

        const start = toMinutes(appointment.time)
        const end = start + SLOT_MINUTES

        return (
            start < toMinutes(hours.open) ||
            end > toMinutes(hours.close)
        )
    })

    if (conflicts) {
        return {
            error: "The requested hours conflict with existing appointments. Adjust them before approval.",
        }
    }

    const now = new Date()
    const note = adminNote.trim().slice(0, 500)

    const claimed = await DoctorScheduleRequest.updateOne(
        { _id: requestId, status: "pending" },
        {
            $set: {
                status: "approved",
                reviewedBy: session.user.id,
                reviewedAt: now,
                adminNote: note || undefined,
            },
        }
    )

    if (claimed.modifiedCount === 0) {
        return { error: "This schedule request has already been reviewed." }
    }

    try {
        const updatedDoctor = await Doctor.updateOne(
            { _id: doctor._id },
            { $set: { schedule: requestedSchedule } }
        )

        if (updatedDoctor.matchedCount === 0) {
            throw new Error("Doctor not found.")
        }
    } catch (error) {
        await DoctorScheduleRequest.updateOne(
            {
                _id: requestId,
                status: "approved",
                reviewedBy: session.user.id,
            },
            {
                $set: { status: "pending" },
                $unset: {
                    reviewedBy: "",
                    reviewedAt: "",
                    adminNote: "",
                },
            }
        )

        console.error("Apply approved schedule change failed:", error)

        return {
            error: "Could not apply the approved schedule. Please try again.",
        }
    }

    await Appointment.updateMany(
        { scheduleChangeRequestId: requestId },
        { $unset: { scheduleChangeRequestId: "" } }
    )

    revalidateSchedulePages()
    return { success: true }
}

export async function rejectScheduleChange(
    requestId: string,
    adminNote = ""
): Promise<ScheduleReviewResult> {
    const session = await requireRole("admin")

    if (!isValidObjectId(requestId)) {
        return { error: "Invalid schedule request." }
    }

    await connectDB()

    const result = await DoctorScheduleRequest.updateOne(
        { _id: requestId, status: "pending" },
        {
            $set: {
                status: "rejected",
                reviewedBy: session.user.id,
                reviewedAt: new Date(),
                adminNote: adminNote.trim().slice(0, 500) || undefined,
            },
        }
    )

    if (result.modifiedCount === 0) {
        return { error: "Pending schedule request not found." }
    }

    await Appointment.updateMany(
        { scheduleChangeRequestId: requestId },
        { $unset: { scheduleChangeRequestId: "" } }
    )

    revalidateSchedulePages()
    return { success: true }
}

export async function requestPatientReschedule(
    requestId: string,
    appointmentId: string
): Promise<ScheduleReviewResult> {
    await requireRole("admin")

    if (!isValidObjectId(requestId) || !isValidObjectId(appointmentId)) {
        return { error: "Invalid schedule request." }
    }

    await connectDB()

    const request = await DoctorScheduleRequest.findOne({
        _id: requestId,
        status: "pending",
    })
        .select("doctor requestedSchedule")
        .lean()

    if (!request) {
        return { error: "Schedule request not found or no longer pending." }
    }

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const appointment = await Appointment.findOne({
        _id: appointmentId,
        doctor: request.doctor,
        date: { $gte: today },
        status: { $in: ["pending", "confirmed"] },
    })
        .select("date time scheduleChangeRequestId")
        .lean()

    if (
        !appointment ||
        appointmentHasPassed(appointment.date, appointment.time)
    ) {
        return {
            error: "Appointment not found or no longer eligible for rescheduling.",
        }
    }

    const requestedSchedule = normalizeWeek(request.requestedSchedule)
    const date = new Date(appointment.date)
    const day = DAYS[(date.getUTCDay() + 6) % 7]
    const hours = requestedSchedule.find((item) => item.day === day)

    const start = toMinutes(appointment.time)
    const end = start + SLOT_MINUTES

    const conflicts =
        !hours ||
        hours.closed ||
        !Number.isFinite(start) ||
        start < toMinutes(hours.open) ||
        end > toMinutes(hours.close)

    if (!conflicts) {
        return {
            error: "This appointment no longer conflicts with the requested hours.",
        }
    }

    const existingRequestId = appointment.scheduleChangeRequestId
        ? String(appointment.scheduleChangeRequestId)
        : ""

    if (existingRequestId === requestId) {
        return { success: true }
    }

    if (existingRequestId) {
        return {
            error: "This appointment already has a reschedule request.",
        }
    }

    const updated = await Appointment.updateOne(
        {
            _id: appointmentId,
            doctor: request.doctor,
            status: { $in: ["pending", "confirmed"] },
            $or: [
                { scheduleChangeRequestId: { $exists: false } },
                { scheduleChangeRequestId: null },
            ],
        },
        {
            $set: { scheduleChangeRequestId: request._id },
        }
    )

    if (updated.modifiedCount === 0) {
        return {
            error: "This appointment already has a reschedule request.",
        }
    }

    revalidatePath("/appointments")
    revalidatePath("/admin/schedule-requests")

    return { success: true }
}