import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import { getClinicHours } from "@/lib/clinic-hours"
import { normalizeWeek } from "@/lib/schedule"
import Doctor from "@/models/Doctor"
import Specialty from "@/models/Specialty"
import { DoctorsManager, type DoctorRow, type SpecialtyRow } from "./doctors-manager"

// Records change on every admin mutation; never serve a stale list.
export const dynamic = "force-dynamic"

const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
})

export default async function AdminDoctorsPage() {
    await requireRole("admin")
    await connectDB()

    const [doctorDocs, specialtyDocs, clinicHours] = await Promise.all([
        Doctor.find().sort({ createdAt: -1 }).lean(),
        Specialty.find().sort({ name: 1 }).lean(),
        getClinicHours(),
    ])

    const doctors: DoctorRow[] = doctorDocs.map((d) => ({
        id: String(d._id),
        name: d.name,
        specialty: d.specialty,
        email: d.email,
        phone: d.phone ?? "",
        experience: d.experience ?? "",
        status: d.status,
        availability: d.availability,
        joined: dateFmt.format(new Date(d.joinedDate ?? d.createdAt)),
        schedule: normalizeWeek(d.schedule),
    }))

    const specialties: SpecialtyRow[] = specialtyDocs.map((s) => ({
        id: String(s._id),
        name: s.name,
        description: s.description ?? "",
    }))

    return (
        <DoctorsManager
            doctors={doctors}
            specialties={specialties}
            clinicHours={clinicHours}
        />
    )
}
