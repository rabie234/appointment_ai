
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import { slotEnd } from "@/lib/schedule"
import Appointment from "@/models/Appointment"
import Doctor from "@/models/Doctor"
import User from "@/models/User"
import Specialty from "@/models/Specialty"
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

/** Format actual timestamps such as startedAt and completedAt. */
function stampTime(d?: Date | null): string | undefined {
    if (!d) return undefined

    return new Date(d).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    })
}

type PopulatedName = {
    name?: string
    nameAr?: string
    specialty?: string
} | null

type AdminAppointmentsPageProps = {
    searchParams: Promise<{
        appointmentId?: string
        status?: string
    }>
}

export default async function AdminAppointmentsPage({
    searchParams,
}: AdminAppointmentsPageProps) {
    const { appointmentId, status } = await searchParams
    await requireRole("admin")
    await connectDB()

    const [docs, patientDocs, doctorDocs] = await Promise.all([
        Appointment.find()
            .populate<{ patient: PopulatedName }>(
                "patient",
                "name"
            )
            .populate<{ doctor: PopulatedName }>(
                "doctor",
                "name nameAr specialty"
            )
            .sort({ date: 1, time: 1 })
            .lean(),

        User.find({ role: "patient" })
            .select("name email")
            .sort({ name: 1 })
            .lean(),

        Doctor.find({ status: "active" })
            .select("name nameAr specialty")
            .sort({ name: 1 })
            .lean(),
    ])

    const patients: PatientOption[] = patientDocs.map((p) => ({
        id: String(p._id),
        name: p.name,
        email: p.email,
    }))

    const doctors: DoctorOption[] = await Promise.all(
        doctorDocs.map(async (doctor) => {
            const specialtyName = doctor.specialty ?? ""

            const specialtyDoc = specialtyName
                ? await Specialty.findOne({
                      name: specialtyName,
                  })
                      .select("name nameAr")
                      .lean()
                : null

            return {
                id: String(doctor._id),
                name: doctor.name,
                nameAr: doctor.nameAr?.trim() || "",
                specialty: specialtyName,
                specialtyAr:
                    specialtyDoc?.nameAr?.trim() || specialtyName,
            }
        })
    )

    const appointments: AdminAppointment[] = await Promise.all(
        docs.map(async (appointment) => {
            const doctor = appointment.doctor

            const specialtyName = doctor?.specialty ?? ""

            const specialtyDoc = specialtyName
                ? await Specialty.findOne({
                      name: specialtyName,
                  })
                      .select("name nameAr")
                      .lean()
                : null

            return {
                id: String(appointment._id),
                scheduledDate: `${new Date(appointment.date).toISOString().slice(0, 10)}T${appointment.time}:00`,
                patient: appointment.patient?.name ?? "Unknown patient",
                doctor: doctor?.name ?? "Unknown doctor",
                doctorNameAr: doctor?.nameAr?.trim() || "",
                specialty: specialtyName,
                specialtyAr:
                    specialtyDoc?.nameAr?.trim() || specialtyName,
                date: dateFmt.format(new Date(appointment.date)),
                time: to12h(appointment.time),
                endTime: to12h(slotEnd(appointment.time)),
                status: appointment.status,
                type: appointment.type,
                price: `$${appointment.price.toFixed(2)}`,
                startedAt: stampTime(appointment.startedAt),
                completedAt: stampTime(appointment.completedAt),
            }
        })
    )
    return (
    <AppointmentsTable
        appointments={appointments}
        patients={patients}
        doctors={doctors}
        initialSelectedAppointmentId={appointmentId}
        initialStatus={status}
    />
)
}

