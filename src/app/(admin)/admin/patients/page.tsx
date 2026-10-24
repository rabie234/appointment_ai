import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import { slotEnd } from "@/lib/schedule"
import User from "@/models/User"
import Appointment from "@/models/Appointment"
import { PatientsManager, type PatientRow, type PatientVisit } from "./patients-manager"

// Records change on every admin mutation; never serve a stale list.
export const dynamic = "force-dynamic"

/** Patients who registered within this many days get a "New" badge. */
const NEW_PATIENT_DAYS = 30

const joinedFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
})

// Appointment dates are stored as UTC midnight, so format them in UTC.
const visitFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
})

function to12h(time: string): string {
    const [h, m] = time.split(":").map(Number)
    if (Number.isNaN(h)) return time
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

type PopulatedDoctor = { name?: string; specialty?: string } | null

export default async function AdminPatientsPage() {
    await requireRole("admin")
    await connectDB()

    const [patientDocs, appointmentDocs] = await Promise.all([
        User.find({ role: "patient" }).select("name email phone createdAt").sort({ createdAt: -1 }).lean(),
        Appointment.find()
            .populate<{ doctor: PopulatedDoctor }>("doctor", "name specialty")
            .select("patient doctor date time type status price")
            .sort({ date: -1, time: -1 })
            .lean(),
    ])

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const newSince = today.getTime() - NEW_PATIENT_DAYS * 24 * 60 * 60 * 1000

    // Group appointments per patient. They arrive newest first.
    const byPatient = new Map<string, typeof appointmentDocs>()
    for (const a of appointmentDocs) {
        const key = String(a.patient)
        const list = byPatient.get(key) ?? []
        list.push(a)
        byPatient.set(key, list)
    }

    const patients: PatientRow[] = patientDocs.map((p) => {
        const appts = byPatient.get(String(p._id)) ?? []
        const completed = appts.filter((a) => a.status === "completed")
        // Soonest booked visit that hasn't happened yet; list is newest first.
        const upcoming = appts
            .filter((a) => (a.status === "pending" || a.status === "confirmed") && new Date(a.date) >= today)
            .at(-1)
        const active = appts.filter(
            (a) => a.status === "pending" || a.status === "confirmed" || a.status === "in-progress"
        ).length

        const visits: PatientVisit[] = appts.map((a) => ({
            id: String(a._id),
            doctor: a.doctor?.name ?? "Unknown doctor",
            specialty: a.doctor?.specialty ?? "",
            date: visitFmt.format(new Date(a.date)),
            time: `${to12h(a.time)} – ${to12h(slotEnd(a.time))}`,
            type: a.type,
            status: a.status,
        }))

        return {
            id: String(p._id),
            name: p.name,
            email: p.email,
            phone: p.phone ?? "",
            joined: joinedFmt.format(new Date(p.createdAt)),
            isNew: new Date(p.createdAt).getTime() >= newSince,
            totalVisits: appts.length,
            completedVisits: completed.length,
            activeVisits: active,
            totalSpent: completed.reduce((sum, a) => sum + a.price, 0),
            lastVisit: completed[0] ? visitFmt.format(new Date(completed[0].date)) : undefined,
            nextVisit: upcoming
                ? `${visitFmt.format(new Date(upcoming.date))}, ${to12h(upcoming.time)}`
                : undefined,
            visits,
        }
    })

    return <PatientsManager patients={patients} />
}
