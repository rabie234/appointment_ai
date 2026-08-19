import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import Appointment from "@/models/Appointment"
// Ensure the Doctor model is registered before we populate it.
import "@/models/Doctor"
import { AppointmentsList, type AppointmentCard } from "./appointments-list"

export const dynamic = "force-dynamic"

const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
})

/** "HH:MM" (24h) → "h:MM AM/PM". */
function to12h(time: string): string {
    const [h, m] = time.split(":").map(Number)
    if (Number.isNaN(h)) return time
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

type Status = "pending" | "confirmed" | "completed" | "cancelled"

function toTab(status: Status): AppointmentCard["tab"] {
    if (status === "cancelled") return "Cancelled"
    if (status === "completed") return "Completed"
    return "Upcoming" // pending + confirmed
}

const STATUS_LABEL: Record<Status, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
}

type PopulatedDoctor = { name?: string; specialty?: string } | null

export default async function MyAppointmentsPage() {
    const session = await requireRole("patient")
    await connectDB()

    const docs = await Appointment.find({ patient: session.user.id })
        .populate<{ doctor: PopulatedDoctor }>("doctor", "name specialty")
        .sort({ date: -1, time: -1 })
        .lean()

    const appointments: AppointmentCard[] = docs.map((a) => {
        const status = a.status as Status
        return {
            id: String(a._id),
            doctor: a.doctor?.name ?? "Unknown doctor",
            specialty: a.doctor?.specialty ?? "",
            date: dateFmt.format(new Date(a.date)),
            time: to12h(a.time),
            tab: toTab(status),
            statusLabel: STATUS_LABEL[status] ?? status,
            type: a.type,
            price: `$${a.price.toFixed(2)}`,
        }
    })

    return <AppointmentsList appointments={appointments} />
}
