import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import Appointment from "@/models/Appointment"
import Doctor from "@/models/Doctor"
import User from "@/models/User"
import {
    AppointmentsTable,
    type AdminAppointment,
    type PatientOption,
    type DoctorOption,
} from "./appointments-table"

export const dynamic = "force-dynamic"

const dateFmt = new Intl.DateTimeFormat("en-US", {
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

type PopulatedName = { name?: string; specialty?: string } | null

export default async function AdminAppointmentsPage() {
    await requireRole("admin")
    await connectDB()

    const [docs, patientDocs, doctorDocs] = await Promise.all([
        Appointment.find()
            .populate<{ patient: PopulatedName }>("patient", "name")
            .populate<{ doctor: PopulatedName }>("doctor", "name specialty")
            // Soonest upcoming first is what an admin working the schedule wants.
            .sort({ date: 1, time: 1 })
            .lean(),
        User.find({ role: "patient" }).select("name email").sort({ name: 1 }).lean(),
        Doctor.find({ status: "active" }).select("name specialty").sort({ name: 1 }).lean(),
    ])

    const appointments: AdminAppointment[] = docs.map((a) => ({
        id: String(a._id),
        patient: a.patient?.name ?? "Unknown patient",
        doctor: a.doctor?.name ?? "Unknown doctor",
        specialty: a.doctor?.specialty ?? "",
        date: dateFmt.format(new Date(a.date)),
        time: to12h(a.time),
        status: a.status,
        type: a.type,
        price: `$${a.price.toFixed(2)}`,
    }))

    const patients: PatientOption[] = patientDocs.map((p) => ({
        id: String(p._id),
        name: p.name,
        email: p.email,
    }))

    const doctors: DoctorOption[] = doctorDocs.map((d) => ({
        id: String(d._id),
        name: d.name,
        specialty: d.specialty,
    }))

    return (
        <AppointmentsTable appointments={appointments} patients={patients} doctors={doctors} />
    )
}
