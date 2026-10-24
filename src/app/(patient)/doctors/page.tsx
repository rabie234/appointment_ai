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
        Doctor.find({ status: "active" }).sort({ name: 1 }).lean(),
        Specialty.find().sort({ name: 1 }).lean(),
    ])

    const doctors: DoctorCard[] = doctorDocs.map((d) => ({
        id: String(d._id),
        name: d.name,
        nameAr: d.nameAr?.trim() || "",
        specialty: d.specialty,
        rating: d.rating ?? 0,
        reviews: d.reviews ?? 0,
        available: d.availability === "available",
        image: d.image ?? "",
    }))

    // Keep the English name as the stable filter value.
    // Use the Arabic name saved in MongoDB for display.
    const specialtyMap: Record<string, string> = {}

    for (const s of specialtyDocs) {
        specialtyMap[s.name] = s.nameAr?.trim() || s.name
    }

    // Include specialties used by active doctors, even if not registered separately.
    const specialties = Array.from(
        new Set([
            ...specialtyDocs.map((s) => s.name),
            ...doctors.map((d) => d.specialty),
        ])
    ).sort()

    return (
        <DoctorsListing
            doctors={doctors}
            specialties={specialties}
            specialtyArabic={specialtyMap}
        />
    )
}