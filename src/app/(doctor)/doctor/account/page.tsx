import { requireDoctor } from "@/lib/doctor-session"
import { getClinicHours } from "@/lib/clinic-hours"
import { normalizeWeek } from "@/lib/schedule"
import { NoProfile } from "../no-profile"
import { AccountForms, type DoctorAccount } from "./account-forms"

export const dynamic = "force-dynamic"

export default async function DoctorAccountPage() {
    const { doctor } = await requireDoctor()
    if (!doctor) return <NoProfile />

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

    return <AccountForms account={account} clinicHours={await getClinicHours()} />
}
