
import { cookies } from "next/headers"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import { slotEnd } from "@/lib/schedule"
import User from "@/models/User"
import Appointment from "@/models/Appointment"
import {
    PatientsManager,
    type PatientRow,
    type PatientVisit,
} from "./patients-manager"

// Records change on every admin mutation; never serve a stale list.
export const dynamic = "force-dynamic"

const NEW_PATIENT_DAYS = 30

type Language = "en" | "ar"

function createDateFormatter(language: Language, timeZone?: string) {
    return new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        {
            month: "short",
            day: "2-digit",
            year: "numeric",
            ...(timeZone ? { timeZone } : {}),
        }
    )
}

function formatTime(time: string, language: Language): string {
    const [hours, minutes] = time.split(":").map(Number)

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return time
    }

    // Arabic uses Arabic locale formatting; English uses 12-hour time.
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)

    return new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        {
            hour: "numeric",
            minute: "2-digit",
            hour12: language === "en",
        }
    ).format(date)
}

type PopulatedDoctor = {
    name?: string
    specialty?: string
} | null

type AdminPatientsPageProps = {
    searchParams: Promise<{
        patientId?: string
    }>
}

export default async function AdminPatientsPage({
    searchParams,
}: AdminPatientsPageProps) {
    const { patientId } = await searchParams
    await requireRole("admin")
    await connectDB()

    const cookieStore = await cookies()
    const savedLanguage = cookieStore.get("clinicai-language")?.value

    const language: Language = savedLanguage === "ar" ? "ar" : "en"

    const joinedFmt = createDateFormatter(language)
    const visitFmt = createDateFormatter(language, "UTC")

    const [patientDocs, appointmentDocs] = await Promise.all([
        User.find({ role: "patient" })
            .select("name email phone createdAt")
            .sort({ createdAt: -1 })
            .lean(),

        Appointment.find()
            .populate<{ doctor: PopulatedDoctor }>(
                "doctor",
                "name specialty"
            )
            .select("patient doctor date time type status price")
            .sort({ date: -1, time: -1 })
            .lean(),
    ])

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const newSince =
        today.getTime() - NEW_PATIENT_DAYS * 24 * 60 * 60 * 1000

    const byPatient = new Map<string, typeof appointmentDocs>()

    for (const appointment of appointmentDocs) {
        const key = String(appointment.patient)
        const list = byPatient.get(key) ?? []

        list.push(appointment)
        byPatient.set(key, list)
    }

    const patients: PatientRow[] = patientDocs.map((patient) => {
        const appointments =
            byPatient.get(String(patient._id)) ?? []

        const completed = appointments.filter(
            (appointment) => appointment.status === "completed"
        )

        // Preserve the existing upcoming appointment selection logic.
        const upcoming = appointments
            .filter(
                (appointment) =>
                    (appointment.status === "pending" ||
                        appointment.status === "confirmed") &&
                    new Date(appointment.date) >= today
            )
            .at(-1)

        const active = appointments.filter(
            (appointment) =>
                appointment.status === "pending" ||
                appointment.status === "confirmed" ||
                appointment.status === "in-progress"
        ).length

        const visits: PatientVisit[] = appointments.map(
            (appointment) => ({
                id: String(appointment._id),
                doctor: appointment.doctor?.name ?? "Unknown doctor",
                specialty: appointment.doctor?.specialty ?? "",
                date: visitFmt.format(new Date(appointment.date)),
                time: `${formatTime(
                    appointment.time,
                    language
                )} – ${formatTime(
                    slotEnd(appointment.time),
                    language
                )}`,
                type: appointment.type,
                status: appointment.status,
            })
        )

        return {
            id: String(patient._id),
            name: patient.name,
            email: patient.email,
            phone: patient.phone ?? "",
            joined: joinedFmt.format(new Date(patient.createdAt)),
            isNew:
                new Date(patient.createdAt).getTime() >= newSince,
            totalVisits: appointments.length,
            completedVisits: completed.length,
            activeVisits: active,
            totalSpent: completed.reduce(
                (sum, appointment) => sum + appointment.price,
                0
            ),
            lastVisit: completed[0]
                ? visitFmt.format(new Date(completed[0].date))
                : undefined,
            nextVisit: upcoming
                ? `${visitFmt.format(
                    new Date(upcoming.date)
                )}, ${formatTime(upcoming.time, language)}`
                : undefined,
            visits,
        }
    })

   return (
    <PatientsManager
        patients={patients}
        initialSelectedPatientId={patientId}
    />
)
}