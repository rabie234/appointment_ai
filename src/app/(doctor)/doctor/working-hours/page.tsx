import connectDB from "@/lib/mongodb"
import { requireDoctor } from "@/lib/doctor-session"
import DoctorScheduleRequest from "@/models/DoctorScheduleRequest"
import { normalizeWeek } from "@/lib/schedule"
import { NoProfile } from "../no-profile"
import {
    WorkingHoursManager,
    type ScheduleChangeRequestView,
} from "./working-hours-manager"

export const dynamic = "force-dynamic"

export default async function DoctorWorkingHoursPage() {
    const { doctor } = await requireDoctor()

    if (!doctor) {
        return <NoProfile />
    }

    await connectDB()

    const requestDocs = await DoctorScheduleRequest.find({
        doctor: doctor._id,
    })
        .sort({ createdAt: -1 })
        .lean()

    const requests: ScheduleChangeRequestView[] = requestDocs.map(
        (request) => ({
            id: String(request._id),
            requestedSchedule: normalizeWeek(request.requestedSchedule),
            status: request.status,
            adminNote: request.adminNote ?? "",
            requestedAt: new Date(request.createdAt).toISOString(),
        })
    )

    return (
        <WorkingHoursManager
            currentSchedule={normalizeWeek(doctor.schedule)}
            requests={requests}
        />
    )
}