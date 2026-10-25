
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import { slotEnd } from "@/lib/schedule"
import Appointment from "@/models/Appointment"
import "@/models/Doctor"
import { AppointmentsList, type AppointmentCard } from "./appointments-list"

export const dynamic = "force-dynamic"

function formatDateISO(date: Date | string): string {
    return new Date(date).toISOString().slice(0, 10)
}

function to12h(time: string): string {
    const [h, m] = time.split(":").map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return time

    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 === 0 ? 12 : h % 12

    return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

type Status =
    | "pending"
    | "confirmed"
    | "in-progress"
    | "completed"
    | "cancelled"
    | "missed"

function toTab(status: Status): AppointmentCard["tab"] {
    if (status === "cancelled") return "Cancelled"
    if (status === "completed") return "Completed"
    if (status === "missed") return "Missed"
    return "Upcoming"
}

const STATUS_LABEL: Record<Status, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    "in-progress": "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    missed: "Missed",
}

type PopulatedDoctor = {
    _id: string | { toString(): string }
    name?: string
    nameAr?: string
    specialty?: string
} | null

export default async function MyAppointmentsPage() {
    const session = await requireRole("patient")
    await connectDB()

    const docs = await Appointment.find({ patient: session.user.id })
        .populate<{ doctor: PopulatedDoctor }>(
    "doctor",
    "name nameAr specialty"
)
        .sort({ date: -1, time: -1 })
        .lean()

    const appointments: AppointmentCard[] = docs.map((a) => {
        const status = a.status as Status

        return {
            id: String(a._id),
            doctorId: String(a.doctor?._id ?? a.doctor),
            leaveConflict: a.leaveConflict ?? false,
            doctor: a.doctor?.name ?? "Unknown doctor",
            doctorAr: a.doctor?.nameAr ?? "",
            specialty: a.doctor?.specialty ?? "",
            date: formatDateISO(a.date),
            time: `${to12h(a.time)} – ${to12h(slotEnd(a.time))}`,
            tab: toTab(status),
            statusLabel: STATUS_LABEL[status] ?? status,
            type: a.type,
            price: `$${a.price.toFixed(2)}`,
            cancellationReason: a.cancellationReason ?? "",
        }
    })

    return <AppointmentsList appointments={appointments} />
}
