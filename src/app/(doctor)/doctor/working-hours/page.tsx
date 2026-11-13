import connectDB from "@/lib/mongodb"
import { requireDoctor } from "@/lib/doctor-session"
import DoctorScheduleRequest from "@/models/DoctorScheduleRequest"
import ClinicHours from "@/models/ClinicHours"
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

    const clinicHoursDoc = await ClinicHours.findOne({ key: "clinic" })
        .select("hours createdAt version lastChangedDays")
        .lean()
    const clinicHoursVersion = clinicHoursDoc
        ? `${new Date(clinicHoursDoc.createdAt).toISOString()}:${clinicHoursDoc.version ?? 0}`
        : "default"

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
            clinicSchedule={normalizeWeek(clinicHoursDoc?.hours)}
            clinicChangedDays={clinicHoursDoc?.lastChangedDays ?? []}
            clinicHoursVersion={clinicHoursVersion}
            acknowledgedClinicHoursVersion={doctor.clinicHoursAcknowledgedVersion ?? ""}
            requests={requests}
        />
    )
}
