import { requireDoctor } from "@/lib/doctor-session"
import { NoProfile } from "../no-profile"
import { AccountForms, type DoctorAccount } from "./account-forms"

export const dynamic = "force-dynamic"

export default async function DoctorAccountPage() {
    const { doctor } = await requireDoctor()

    if (!doctor) {
        return <NoProfile />
    }

    const account: DoctorAccount = {
        name: doctor.name,
        nameAr: doctor.nameAr ?? "",
        email: doctor.email,
        phone: doctor.phone ?? "",
        experience: doctor.experience ?? "",
        specialty: doctor.specialty,
        status: doctor.status,
    }

    return <AccountForms account={account} />
}