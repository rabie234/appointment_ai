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

    // Prepare doctor data for the listing
    const doctors: DoctorCard[] = doctorDocs.map((doctor) => ({
        id: String(doctor._id),
        name: doctor.name,
        nameAr: doctor.nameAr?.trim() || "",
        specialty: doctor.specialty,
        available: doctor.availability === "available",
        image: doctor.image ?? "",
    }))

    // Prepare Arabic specialty translations
    const specialtyMap: Record<string, string> = {}

    for (const specialty of specialtyDocs) {
        specialtyMap[specialty.name] =
            specialty.nameAr?.trim() || specialty.name
    }

    // Include specialties used by active doctors
    const specialties = Array.from(
        new Set([
            ...specialtyDocs.map((specialty) => specialty.name),
            ...doctors.map((doctor) => doctor.specialty),
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