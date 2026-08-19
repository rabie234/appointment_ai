import connectDB from "@/lib/mongodb"
import { requireRole } from "@/lib/session"
import Doctor from "@/models/Doctor"
import Specialty from "@/models/Specialty"
import { DoctorsListing, type DoctorCard } from "./doctors-listing"

export const dynamic = "force-dynamic"

export default async function DoctorsListingPage() {
    await requireRole("patient")
    await connectDB()

    const [doctorDocs, specialtyDocs] = await Promise.all([
        // Patients only ever see active doctors.
        Doctor.find({ status: "active" }).sort({ name: 1 }).lean(),
        Specialty.find().sort({ name: 1 }).lean(),
    ])

    const doctors: DoctorCard[] = doctorDocs.map((d) => ({
        id: String(d._id),
        name: d.name,
        specialty: d.specialty,
        rating: d.rating ?? 0,
        reviews: d.reviews ?? 0,
        available: d.availability === "available",
        image: d.image ?? "",
    }))

    // Offer the specialties admins defined, plus any a doctor uses that isn't
    // in that list yet, so the filter never hides a bookable doctor.
    const specialties = Array.from(
        new Set([
            ...specialtyDocs.map((s) => s.name),
            ...doctors.map((d) => d.specialty),
        ])
    ).sort()

    return <DoctorsListing doctors={doctors} specialties={specialties} />
}
