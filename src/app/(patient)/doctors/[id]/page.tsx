import Link from "next/link"
import { notFound } from "next/navigation"
import { isValidObjectId } from "mongoose"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import TranslatedText from "@/components/i18n/translated-text"
import {
    Star,
    MapPin,
    ChevronLeft,
    ShieldCheck,
    Award,
    BookOpen,
} from "lucide-react"
import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import { normalizeWeek } from "@/lib/schedule"
import Doctor from "@/models/Doctor"
import { BookingPanel } from "./booking-panel"
import DoctorProfileDisplay from "./doctor-profile-display"

export const dynamic = "force-dynamic"

const CONSULTATION_FEE = 120

function formatHours(open: string, close: string): string {
    return `${to12h(open)} - ${to12h(close)}`
}

function to12h(time: string): string {
    const [h, m] = time.split(":").map(Number)
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

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
                availability: doctor.availability,
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
