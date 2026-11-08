import { notFound } from "next/navigation"
import { isValidObjectId } from "mongoose"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import { normalizeWeek } from "@/lib/schedule"
import Doctor from "@/models/Doctor"
import DoctorProfileDisplay from "./doctor-profile-display"

export const dynamic = "force-dynamic"

const CONSULTATION_FEE = 120

export default async function DoctorProfilePage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    await requireRole("patient")
    const { id } = await params

    if (!isValidObjectId(id)) notFound()

    await connectDB()

    const doctor = await Doctor.findById(id).lean()

    if (!doctor) notFound()

    const schedule = normalizeWeek(doctor.schedule)
    const workingDays = schedule
        .filter((day) => !day.closed)
        .map((day) => ({
            day: String(day.day),
            open: String(day.open),
            close: String(day.close),
        }))

    return (
        <DoctorProfileDisplay
            doctor={{
                id: String(doctor._id),
                name: doctor.name,
                nameAr: doctor.nameAr || "",
                image: doctor.image || "",
                specialty: doctor.specialty,
                rating: doctor.rating,
                reviews: doctor.reviews,
                experience: doctor.experience,
                successRate: doctor.successRate,
                totalPatients: doctor.totalPatients,
                active: doctor.status === "active",
            }}
            workingDays={workingDays}
            consultationFee={CONSULTATION_FEE}
        />
    )
}
