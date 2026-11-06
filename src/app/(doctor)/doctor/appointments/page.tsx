import { cookies } from "next/headers"
import connectDB from "@/lib/mongodb"
import { requireDoctor } from "@/lib/doctor-session"
import { slotEnd } from "@/lib/schedule"
import Appointment from "@/models/Appointment"
import { NoProfile } from "../no-profile"
import {
    DoctorAppointmentsManager,
    type DoctorAppointment,
} from "./appointments-manager"

// Statuses change on every action; never serve a stale list.
export const dynamic = "force-dynamic"

const DAY_MS = 24 * 60 * 60 * 1000

function to12h(time: string, locale: string): string {
    const [hours, minutes] = time.split(":").map(Number)

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return time

    const date = new Date(Date.UTC(2020, 0, 1, hours, minutes))

    return new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "UTC",
    }).format(date)
}

function stampTime(
    date?: Date | null,
    locale = "en-US"
): string | undefined {
    if (!date) return undefined

    return new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "UTC",
    }).format(new Date(date))
}

type PopulatedPatient = {
    name?: string
    email?: string
    phone?: string
} | null

export default async function DoctorAppointmentsPage() {
    const cookieStore = await cookies()
    const language =
        cookieStore.get("clinicai-language")?.value === "ar" ? "ar" : "en"
    const locale = language === "ar" ? "ar-LB" : "en-US"

    // Appointment dates are stored at UTC midnight, so keep formatting in UTC.
    const dateFmt = new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
    })

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

    const appointments: DoctorAppointment[] = docs.map((appointment) => {
        const day = new Date(appointment.date).getTime()

        return {
            id: String(appointment._id),
            patient: appointment.patient?.name ?? "Unknown patient",
            patientEmail: appointment.patient?.email ?? "",
            patientPhone: appointment.patient?.phone ?? "",
            date: dateFmt.format(new Date(appointment.date)),
            time: to12h(appointment.time, locale),
            endTime: to12h(slotEnd(appointment.time), locale),
            sortKey: `${new Date(appointment.date).toISOString().slice(0, 10)} ${appointment.time}`,
            tab:
                day >= tomorrow
                    ? "upcoming"
                    : day === today.getTime()
                        ? "today"
                        : "past",
            status: appointment.status,
            type: appointment.type,
            notes: appointment.notes ?? "",
            startedAt: stampTime(appointment.startedAt, locale),
            completedAt: stampTime(appointment.completedAt, locale),
            cancellationReason: appointment.cancellationReason ?? "",
        }
    })

    return (
        <DoctorAppointmentsManager
            doctorName={doctor.name}
            appointments={appointments}
        />
    )
}