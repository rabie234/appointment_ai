import { requireDoctor } from "@/lib/doctor-session"
import connectDB from "@/lib/mongodb"
import DoctorLeave from "@/models/DoctorLeave"
import { NoProfile } from "../no-profile"
import { LeaveRequestsManager } from "./leave-requests-manager"

export const dynamic = "force-dynamic"

export default async function DoctorLeavesPage() {
    const { doctor } = await requireDoctor()

    if (!doctor) {
        return <NoProfile />
    }

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
            // Older leave records were created directly by Admin.
            status: leave.status ?? "approved",
            adminNote: leave.adminNote ?? "",
        }
    })

    return <LeaveRequestsManager leaveRequests={leaveRequests} />
}