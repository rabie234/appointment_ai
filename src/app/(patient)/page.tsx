import PatientDashboardClient from "@/components/layout/patient-dashboard-client"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import Appointment from "@/models/Appointment"
import Doctor from "@/models/Doctor"

export const dynamic = "force-dynamic"

type PopulatedDoctor = { name?: string; specialty?: string } | null

export default async function PatientDashboard() {
  const session = await requireRole("patient")
  await connectDB()

  const now = new Date()
  const [nextAppt, upcomingCount, doctorCount] = await Promise.all([
    Appointment.findOne({
      patient: session.user.id,
      date: { $gte: new Date(now.toISOString().slice(0, 10)) },
      status: { $in: ["pending", "confirmed"] },
    })
      .populate<{ doctor: PopulatedDoctor }>("doctor", "name specialty")
      .sort({ date: 1, time: 1 })
      .lean(),
    Appointment.countDocuments({
      patient: session.user.id,
      status: { $in: ["pending", "confirmed"] },
    }),
    Doctor.countDocuments({ status: "active" }),
  ])

  const firstName = session.user.name?.split(" ")[0] ?? "there"

  const appointment = nextAppt
    ? {
        doctorName: nextAppt.doctor?.name ?? "Doctor",
        specialty: nextAppt.doctor?.specialty ?? "",
        date: String(nextAppt.date),
        time: nextAppt.time,
      }
    : null

  return (
    <PatientDashboardClient
      firstName={firstName}
      upcomingCount={upcomingCount}
      doctorCount={doctorCount}
      appointment={appointment}
    />
  )
}
