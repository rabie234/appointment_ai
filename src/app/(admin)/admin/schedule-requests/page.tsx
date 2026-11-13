import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import Appointment from "@/models/Appointment"
import DoctorScheduleRequest from "@/models/DoctorScheduleRequest"
import { appointmentHasPassed } from "@/lib/appointment-transitions"
import {
    DAYS,
    normalizeWeek,
    slotsForDay,
} from "@/lib/schedule"
import {
    ScheduleRequestsManager,
    type ScheduleRequestRow,
} from "./schedule-requests-manager"

export const dynamic = "force-dynamic"

type PopulatedDoctor = {
    _id?: unknown
    name?: string
    nameAr?: string
    specialty?: string
    schedule?: unknown
} | null

type PopulatedPatient = {
    name?: string
} | null

function conflictsWithSchedule(
    date: Date,
    time: string,
    schedule: ScheduleRequestRow["requestedSchedule"]
) {
    const day = DAYS[(date.getUTCDay() + 6) % 7]
    const hours = schedule.find((item) => item.day === day)

    return !hours || hours.closed || !slotsForDay(hours).includes(time)
}

export default async function ScheduleRequestsPage() {
    await requireRole("admin")
    await connectDB()

    const documents = await DoctorScheduleRequest.find({ status: "pending" })
        .populate<{ doctor: PopulatedDoctor }>(
            "doctor",
            "name nameAr specialty schedule"
        )
        .sort({ createdAt: 1 })
        .lean()

    const doctorIds = documents.flatMap((request) =>
        request.doctor?._id ? [String(request.doctor._id)] : []
    )

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const appointmentDocuments =
        doctorIds.length > 0
            ? await Appointment.find({
                  doctor: { $in: doctorIds },
                  date: { $gte: today },
                  status: {
                      $in: ["pending", "confirmed", "in-progress"],
                  },
              })
                  .populate<{ patient: PopulatedPatient }>(
                      "patient",
                      "name"
                  )
                  .select(
                      "doctor patient date time status scheduleChangeRequestId"
                  )
                  .sort({ date: 1, time: 1 })
                  .lean()
            : []

    const requests: ScheduleRequestRow[] = documents.map((request) => {
        const doctor = request.doctor
        const doctorId = doctor?._id ? String(doctor._id) : ""
        const requestId = String(request._id)
        const requestedSchedule = normalizeWeek(request.requestedSchedule)

        const conflicts = appointmentDocuments
            .filter((appointment) => {
                if (String(appointment.doctor) !== doctorId) return false

                const date = new Date(appointment.date)

                if (appointmentHasPassed(date, appointment.time)) {
                    return false
                }

                return conflictsWithSchedule(
                    date,
                    appointment.time,
                    requestedSchedule
                )
            })
            .map((appointment) => ({
                id: String(appointment._id),
                patientName: appointment.patient?.name ?? "Unknown patient",
                date: new Date(appointment.date).toISOString().slice(0, 10),
                time: appointment.time,
                status: appointment.status,
                rescheduleRequested:
                    String(appointment.scheduleChangeRequestId ?? "") ===
                    requestId,
            }))

        return {
            id: requestId,
            doctorName: doctor?.name ?? "Deleted doctor",
            doctorNameAr: doctor?.nameAr ?? doctor?.name ?? "Deleted doctor",
            specialty: doctor?.specialty ?? "",
            doctorExists: Boolean(doctor),
            currentSchedule: normalizeWeek(doctor?.schedule),
            requestedSchedule,
            reason: request.reason ?? "",
            requestedAt: new Date(request.createdAt).toISOString(),
            conflicts,
        }
    })

    return <ScheduleRequestsManager requests={requests} />
}