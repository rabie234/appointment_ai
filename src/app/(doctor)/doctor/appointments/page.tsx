import connectDB from "@/lib/mongodb"
import { requireDoctor } from "@/lib/doctor-session"
import { slotEnd } from "@/lib/schedule"
import { appointmentHasPassed } from "@/lib/appointment-transitions"
import Appointment from "@/models/Appointment"
import { NoProfile } from "../no-profile"
import { DoctorAppointmentsManager, type DoctorAppointment } from "./appointments-manager"

// Statuses change on every action; never serve a stale list.
export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000

// Appointment dates are stored as UTC midnight, so format them in UTC.
const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
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

function stampTime(d?: Date | null): string | undefined {
    if (!d) return undefined
    return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

type PopulatedPatient = { name?: string; email?: string; phone?: string } | null

export default async function DoctorAppointmentsPage() {
    const { doctor } = await requireDoctor()
    if (!doctor) return <NoProfile />
    await connectDB()

    const docs = await Appointment.find({ doctor: doctor._id })
        .populate<{ patient: PopulatedPatient }>("patient", "name email phone")
        .sort({ date: 1, time: 1 })
        .lean()

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const tomorrow = today.getTime() + DAY_MS

    const appointments: DoctorAppointment[] = docs.map((a) => {
        const day = new Date(a.date).getTime()
        const open = a.status === "pending" || a.status === "confirmed"
        return {
            id: String(a._id),
            patient: a.patient?.name ?? "Unknown patient",
            patientEmail: a.patient?.email ?? "",
            patientPhone: a.patient?.phone ?? "",
            date: dateFmt.format(new Date(a.date)),
            time: to12h(a.time),
            endTime: to12h(slotEnd(a.time)),
            sortKey: `${new Date(a.date).toISOString().slice(0, 10)} ${a.time}`,
            tab: day >= tomorrow ? "upcoming" : day === today.getTime() ? "today" : "past",
            status: a.status,
            type: a.type,
            notes: a.notes ?? "",
            startedAt: stampTime(a.startedAt),
            completedAt: stampTime(a.completedAt),
            cancellationReason: a.cancellationReason ?? "",
            canMarkMissed: open && appointmentHasPassed(a.date, a.time),
        }
    })

    return <DoctorAppointmentsManager doctorName={doctor.name} appointments={appointments} />
}
