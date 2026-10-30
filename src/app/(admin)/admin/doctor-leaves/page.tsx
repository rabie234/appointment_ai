
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import DoctorLeave from "@/models/DoctorLeave"
import Appointment from "@/models/Appointment"
import Specialty from "@/models/Specialty"
import {
    DoctorLeavesManager,
    type DoctorLeaveRow,
} from "./doctor-leaves-manager"
import DoctorLeavesHeading from "./doctor-leaves-heading"

export const dynamic = "force-dynamic"

export default async function DoctorLeavesPage() {
    await requireRole("admin")
    await connectDB()

    const leaveDocs = await DoctorLeave.find()
        .populate("doctor", "name nameAr specialty")
        .sort({ startDate: -1 })
        .lean()

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const leaves: DoctorLeaveRow[] = await Promise.all(
        leaveDocs.map(async (leave) => {
            const start = new Date(leave.startDate)
            const exclusiveEnd = new Date(leave.endDate)

            // endDate is exclusive in the database.
            const end = new Date(exclusiveEnd)
            end.setUTCDate(end.getUTCDate() - 1)

            const doctor = leave.doctor as unknown as {
                _id: import("mongoose").Types.ObjectId
                name: string
                nameAr?: string
                specialty: string
            } | null

            let status: DoctorLeaveRow["status"] = "Upcoming"

            if (end < today) {
                status = "Past"
            } else if (start <= today && end >= today) {
                status = "Ongoing"
            }

            const appointments = doctor
                ? await Appointment.find({
                      doctor: doctor._id,
                      date: {
                          $gte: start,
                          $lt: exclusiveEnd,
                      },
                      leaveConflict: true,
                      status: {
                          $in: ["pending", "confirmed"],
                      },
                  })
                      .populate("patient", "name email")
                      .sort({ date: 1, time: 1 })
                      .lean()
                : []

            const affectedAppointments = appointments.map(
                (appointment) => {
                    const patient = appointment.patient as unknown as {
                        _id: import("mongoose").Types.ObjectId
                        name?: string
                        email?: string
                    } | null

                    return {
                        id: String(appointment._id),
                        patientName:
                            patient?.name ?? "Unknown patient",
                        patientEmail: patient?.email ?? "",
                        date: new Date(appointment.date)
                            .toISOString()
                            .slice(0, 10),
                        time: appointment.time,
                        status: appointment.status,
                        type: appointment.type,
                    }
                }
            )

            // Find the Arabic specialty name using the English name
            // stored in the Doctor document.
            const specialtyName = doctor?.specialty ?? "—"

            const specialtyDoc =
                specialtyName !== "—"
                    ? await Specialty.findOne({
                          name: specialtyName,
                      })
                          .select("name nameAr")
                          .lean()
                    : null

            const specialtyNameAr =
                specialtyDoc?.nameAr?.trim() || specialtyName

            return {
                id: String(leave._id),
                doctorName: doctor?.name ?? "Deleted doctor",
                doctorNameAr:
                    doctor?.nameAr?.trim() ||
                    doctor?.name ||
                    "—",
                specialty: specialtyName,
                specialtyAr: specialtyNameAr,
                startDate: start.toISOString().slice(0, 10),
                endDate: end.toISOString().slice(0, 10),
                reason: leave.reason ?? "",
                status,
                affectedCount: affectedAppointments.length,
                affectedAppointments,
            }
        })
    )

    return (
        <div className="space-y-6">
            <DoctorLeavesHeading />

            <DoctorLeavesManager leaves={leaves} />
        </div>
    )
}
