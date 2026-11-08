
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import DoctorLeave from "@/models/DoctorLeave"
import Doctor from "@/models/Doctor"
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

    // Fetch active doctors for the Schedule Leave form.
    const doctors = await Doctor.find({ status: "active" })
        .select("_id name nameAr specialty")
        .sort({ name: 1 })
        .lean()

    const doctorOptions = doctors.map((doctor) => ({
        id: String(doctor._id),
        name: doctor.name,
        nameAr: doctor.nameAr || "",
        specialty: doctor.specialty,
    }))

    // Fetch pending leave requests.
    const pendingDocs = await DoctorLeave.find({ status: "pending" })
        .populate("doctor", "name nameAr specialty")
        .sort({ createdAt: -1 })
        .lean()

    // Fetch rejected leave requests.
    const rejectedDocs = await DoctorLeave.find({ status: "rejected" })
        .populate("doctor", "name nameAr specialty")
        .sort({ reviewedAt: -1 })
        .lean()

    // Older Admin-created records without a status are treated as approved.
    const leaveDocs = await DoctorLeave.find({
        $or: [
            { status: "approved" },
            { status: { $exists: false } },
        ],
    })
        .populate("doctor", "name nameAr specialty")
        .sort({ startDate: -1 })
        .lean()

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Format pending requests.
    const pendingRequests = pendingDocs.map((request) => {
        const doctor = request.doctor as unknown as {
            name?: string
            nameAr?: string
            specialty?: string
        } | null

        const endDate = new Date(request.endDate)
        endDate.setUTCDate(endDate.getUTCDate() - 1)

        return {
            id: String(request._id),
            doctorName: doctor?.name ?? "Deleted doctor",
            doctorNameAr: doctor?.nameAr ?? doctor?.name ?? "Deleted doctor",
            specialty: doctor?.specialty ?? "",
            startDate: new Date(request.startDate)
                .toISOString()
                .slice(0, 10),
            endDate: endDate.toISOString().slice(0, 10),
            reason: request.reason ?? "",
        }
    })

    // Format rejected requests.
    const rejectedRequests = rejectedDocs.map((request) => {
        const doctor = request.doctor as unknown as {
            name?: string
            nameAr?: string
            specialty?: string
        } | null

        const endDate = new Date(request.endDate)
        endDate.setUTCDate(endDate.getUTCDate() - 1)

        return {
            id: String(request._id),
            doctorName: doctor?.name ?? "Deleted doctor",
            doctorNameAr: doctor?.nameAr ?? doctor?.name ?? "Deleted doctor",
            specialty: doctor?.specialty ?? "",
            startDate: new Date(request.startDate)
                .toISOString()
                .slice(0, 10),
            endDate: endDate.toISOString().slice(0, 10),
            reason: request.reason ?? "",
            adminNote: request.adminNote ?? "",
        }
    })

    // Format approved leave records and their affected appointments.
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
                        patientName: patient?.name ?? "Unknown patient",
                        patientEmail: patient?.email ?? "",
                        date: new Date(appointment.date)
                            .toISOString()
                            .slice(0, 10),
                        time: appointment.time,
                        status: appointment.status,
                        type: appointment.type,
                    }
                },
            )

            const specialtyName = doctor?.specialty ?? "—"

            const specialtyDoc =
                specialtyName !== "—"
                    ? await Specialty.findOne({ name: specialtyName })
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
        }),
    )

    return (
        <div className="space-y-6">
            <DoctorLeavesHeading doctors={doctorOptions} />

            <DoctorLeavesManager
                leaves={leaves}
                pendingRequests={pendingRequests}
                rejectedRequests={rejectedRequests}
            />
        </div>
    )
}
