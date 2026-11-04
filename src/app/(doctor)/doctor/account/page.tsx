import { requireDoctor } from "@/lib/doctor-session"
import { getClinicHours } from "@/lib/clinic-hours"
import { normalizeWeek } from "@/lib/schedule"
import { NoProfile } from "../no-profile"
import { AccountForms, type DoctorAccount } from "./account-forms"
import connectDB from "@/lib/mongodb"
import DoctorLeave from "@/models/DoctorLeave"

export const dynamic = "force-dynamic"

export default async function DoctorAccountPage() {
    const { doctor } = await requireDoctor()
    if (!doctor) return <NoProfile />
    await connectDB()

    const leaveDocs = await DoctorLeave.find({ doctor: doctor._id })
        .sort({ startDate: -1 })
        .lean()

    const leaveRequests = leaveDocs.map((leave) => {
        const endDate = new Date(leave.endDate)
        endDate.setUTCDate(endDate.getUTCDate() - 1)

        return {
            id: String(leave._id),
            startDate: new Date(leave.startDate).toISOString().slice(0, 10),
            endDate: endDate.toISOString().slice(0, 10),
            reason: leave.reason ?? "",
            // Older leave records predate approval status and were created directly by Admin.
            status: leave.status ?? "approved",
            adminNote: leave.adminNote ?? "",
        }
    })
    const account: DoctorAccount = {
        name: doctor.name,
        nameAr: doctor.nameAr ?? "",
        email: doctor.email,
        phone: doctor.phone ?? "",
        experience: doctor.experience ?? "",
        specialty: doctor.specialty,
        status: doctor.status,
        availability: doctor.availability,
        schedule: normalizeWeek(doctor.schedule),
    }

    return (
    <AccountForms
        account={account}
        clinicHours={await getClinicHours()}
        leaveRequests={leaveRequests}
    />
)
}
