
"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Star, Clock, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

export type DoctorCard = {
    id: string
    name: string
    nameAr: string
    specialty: string
    rating: number
    reviews: number
    available: boolean
    image: string
}

const ALL = "All Specialties"

const DEFAULT_SPECIALTY_ARABIC: Record<string, string> = {
    "All Specialties": "كل الاختصاصات",
    "Cardiology": "أمراض القلب",
    "Dermatology": "الأمراض الجلدية",
    "Neurology": "طب الأعصاب",
    "Pediatrics": "طب الأطفال",
    "Orthopedics": "طب العظام",
    "Gastroenterology": "أمراض الجهاز الهضمي",
    "Psychiatry": "الطب النفسي",
    "Ophthalmology": "طب العيون",
    "ENT": "الأنف والأذن والحنجرة",
    "General Medicine": "الطب العام",
}

export function DoctorsListing({
    doctors,
    specialties,
    specialtyArabic,
}: {
    doctors: DoctorCard[]
    specialties: string[]
    specialtyArabic: Record<string, string>
}) {
    const { language } = useLanguage()
    const isArabic = language === "ar"

    const [selectedSpecialty, setSelectedSpecialty] = useState(ALL)
    const [availableOnly, setAvailableOnly] = useState(false)
    const [search, setSearch] = useState("")

    const specialtyMap = {
        ...DEFAULT_SPECIALTY_ARABIC,
        ...specialtyArabic,
    }

    const term = search.trim().toLocaleLowerCase(
        isArabic ? "ar" : "en"
    )

    const filtered = doctors.filter((doctor) => {
        if (
            selectedSpecialty !== ALL &&
            doctor.specialty !== selectedSpecialty
        ) {
            return false
        }

        if (availableOnly && !doctor.available) {
            return false
        }

        const name = doctor.name.toLocaleLowerCase(
            isArabic ? "ar" : "en"
        )
        const specialty = doctor.specialty.toLocaleLowerCase(
            isArabic ? "ar" : "en"
        )
        const arabicSpecialty = (
            specialtyMap[doctor.specialty] ?? ""
        ).toLocaleLowerCase("ar")

        if (
            term &&
            !name.includes(term) &&
            !specialty.includes(term) &&
            !arabicSpecialty.includes(term)
        ) {
            return false
        }

        return true
    })

    const specialtyOptions = [
        ALL,
        ...specialties.filter((specialty) => specialty !== ALL),
    ]

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t(language, "Find a Doctor")}
                    </h1>

                    <p className="text-muted-foreground mt-1">
                        {isArabic
                            ? `${new Intl.NumberFormat("ar-LB").format(filtered.length)} طبيب متاح للحجز`
                            : `${filtered.length} ${filtered.length === 1 ? "specialist" : "specialists"} available to book.`}
                    </p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search
                        className={cn(
                            "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
                            isArabic ? "right-3" : "left-3"
                        )}
                    />

                    <Input
                        placeholder={t(
                            language,
                            "Search by doctor or specialty..."
                        )}
                        className={cn(
                            "bg-card border-none shadow-sm",
                            isArabic ? "pr-10 text-right" : "pl-10 text-left"
                        )}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                <aside className="w-full lg:w-64 space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                            {t(language, "Specialty")}
                        </h3>

                        <div className="space-y-1">
                            {specialtyOptions.map((specialty) => (
                                <button
                                    type="button"
                                    key={specialty}
                                    onClick={() => setSelectedSpecialty(specialty)}
                                    className={cn(
                                        "w-full px-3 py-2 rounded-lg text-sm transition-colors",
                                        isArabic ? "text-right" : "text-left",
                                        selectedSpecialty === specialty
                                            ? "bg-primary text-primary-foreground font-medium"
                                            : "hover:bg-accent hover:text-accent-foreground"
                                    )}
                                >
                                    {isArabic
                                        ? specialtyMap[specialty] ?? specialty
                                        : specialty}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                            {t(language, "Availability")}
                        </h3>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="available-today"
                                checked={availableOnly}
                                onChange={(event) =>
                                    setAvailableOnly(event.target.checked)
                                }
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />

                            <label
                                htmlFor="available-today"
                                className="text-sm font-medium leading-none"
                            >
                                {t(language, "Available only")}
                            </label>
                        </div>
                    </div>
                </aside>

                <div className="flex-1">
                    {filtered.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground">
                            {t(language, "No doctors match your filters.")}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filtered.map((doctor) => (
                                <Card
                                    key={doctor.id}
                                    className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-none bg-card/60 overflow-hidden"
                                >
                                    <div className="flex flex-col sm:flex-row h-full">
                                        <div className="relative w-full sm:w-40 aspect-square sm:aspect-auto bg-muted flex items-center justify-center">
                                            {doctor.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={doctor.image}
                                                    alt={doctor.name}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <span className="text-4xl font-bold text-primary/40">
                                                    {doctor.name
                                                        .replace(/^Dr\.?\s*/i, "")
                                                        .charAt(0)}
                                                </span>
                                            )}

                                            {doctor.available && (
                                                <Badge
                                                    variant="success"
                                                    className={cn(
                                                        "absolute top-2 shadow-sm",
                                                        isArabic ? "right-2" : "left-2"
                                                    )}
                                                >
                                                    {t(language, "Available")}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex-1 p-5 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start gap-2">
                                                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                                                        {isArabic && doctor.nameAr
                                                        ? doctor.nameAr
                                                          : doctor.name}
                                                    </CardTitle>

                                                    <div className="flex items-center text-amber-500 text-sm font-bold bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded shrink-0">
                                                        <Star className="h-3 w-3 fill-current me-1" />
                                                        {doctor.rating.toFixed(1)}
                                                    </div>
                                                </div>

                                                <p className="text-primary text-sm font-semibold mt-1">
                                                    {isArabic
                                                        ? specialtyMap[doctor.specialty] ??
                                                          doctor.specialty
                                                        : doctor.specialty}
                                                </p>

                                                <div className="mt-4 space-y-2">
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                                                        <span>
                                                            {new Intl.NumberFormat(
                                                                isArabic ? "ar-LB" : "en-US"
                                                            ).format(doctor.reviews)}{" "}
                                                            {t(language, "reviews")}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                                        <span>
                                                            {t(
                                                                language,
                                                                "Downtown Medical Center"
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-6">
                                                <Link href={`/doctors/${doctor.id}`}>
                                                    <Button
                                                        className="w-full shadow-md shadow-blue-100"
                                                        size="sm"
                                                    >
                                                        {t(language, "View Profile")}
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
