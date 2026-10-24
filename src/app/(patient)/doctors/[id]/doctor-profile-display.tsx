
"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Star,
    MapPin,
    ChevronLeft,
    ShieldCheck,
    Award,
    BookOpen,
} from "lucide-react"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import { BookingPanel } from "./booking-panel"

type DoctorData = {
    id: string
    name: string
    nameAr: string
    image: string
    specialty: string
    availability: string
    rating: number
    reviews: number
    experience: string | number
    successRate: number
    totalPatients: number
    active: boolean
}

type WorkingDay = {
    day: string
    open: string
    close: string
}

export default function DoctorProfileDisplay({
    doctor,
    workingDays,
    consultationFee,
}: {
    doctor: DoctorData
    workingDays: WorkingDay[]
    consultationFee: number
}) {
    const { language } = useLanguage()
    const isArabic = language === "ar"

    const doctorName =
        isArabic && doctor.nameAr
            ? doctor.nameAr
            : doctor.name

    function formatExperience(value: string | number) {
        const match = String(value).match(/\d+/)
        if (!match) return String(value)

        const number = match[0]

        return isArabic
            ? `${number} سنوات`
            : `${number} Years`
    }

    function formatTime(time: string) {
        const [hours, minutes] = time.split(":").map(Number)
        const date = new Date()
        date.setHours(hours, minutes, 0, 0)

        return new Intl.DateTimeFormat(
            isArabic ? "en-GB" : "en-US",
            {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            },
        ).format(date)
    }

    function translateDay(day: string) {
        return t(language, day)
    }

    const tones = {
        blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
        emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
        orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    }

    function StatCard({
        icon,
        tone,
        label,
        value,
    }: {
        icon: React.ReactNode
        tone: "blue" | "emerald" | "orange"
        label: string
        value: string
    }) {
        return (
            <Card className="bg-card/50 border-none shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${tones[tone]}`}>
                        {icon}
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">
                            {t(language, label)}
                        </p>
                        <p className="text-sm font-bold">{value}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div
            dir={isArabic ? "rtl" : "ltr"}
            className="space-y-8 animate-in fade-in duration-500"
        >
            <Link
                href="/doctors"
                className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
                <ChevronLeft
                    className={`me-1 h-4 w-4 ${isArabic ? "rotate-180" : ""}`}
                />
                {t(language, "Back to search")}
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section className="flex flex-col md:flex-row gap-6 md:items-end">
                        <div className="h-32 w-32 rounded-2xl bg-muted overflow-hidden border-4 border-card shadow-xl flex-shrink-0 flex items-center justify-center">
                            {doctor.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={doctor.image}
                                    alt={doctorName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-4xl font-bold text-primary/40">
                                    {doctorName
                                        .replace(/^Dr\.?\s*/i, "")
                                        .charAt(0)}
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight">
                                    {doctorName}
                                </h1>

                                <Badge
                                    variant={
                                        doctor.availability === "available"
                                            ? "success"
                                            : "secondary"
                                    }
                                >
                                    {t(
                                        language,
                                        doctor.availability === "available"
                                            ? "Available"
                                            : "On Leave",
                                    )}
                                </Badge>
                            </div>

                            <p className="text-primary font-semibold text-lg">
                                {t(language, doctor.specialty)}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center">
                                    <Star className="h-4 w-4 text-amber-500 fill-current me-1" />
                                    <span
                                        dir="ltr"
                                        className="font-bold text-foreground"
                                    >
                                        {doctor.rating.toFixed(1)}
                                    </span>
                                    <span className="ms-1">
                                        ({doctor.reviews}{" "}
                                        {t(language, "reviews")})
                                    </span>
                                </div>

                                <div className="flex items-center">
                                    <MapPin className="h-4 w-4 text-primary me-1" />
                                    {t(language, "Downtown Medical Center")}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard
                            icon={<ShieldCheck className="h-5 w-5" />}
                            tone="blue"
                            label="Experience"
                            value={
                                doctor.experience
                                    ? formatExperience(doctor.experience)
                                    : "—"
                            }
                        />

                        <StatCard
                            icon={<Award className="h-5 w-5" />}
                            tone="emerald"
                            label="Success Rate"
                            value={`${doctor.successRate}%`}
                        />

                        <StatCard
                            icon={<BookOpen className="h-5 w-5" />}
                            tone="orange"
                            label="Total Patients"
                            value={doctor.totalPatients.toLocaleString(
                                isArabic ? "en-GB" : "en-US",
                            )}
                        />
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold">
                            {t(language, "Working Hours")}
                        </h2>

                        <div className="bg-card/50 rounded-xl border overflow-hidden">
                            {workingDays.length === 0 ? (
                                <p className="px-6 py-4 text-sm text-muted-foreground">
                                    {t(
                                        language,
                                        "No working hours set for this doctor yet.",
                                    )}
                                </p>
                            ) : (
                                <table className="w-full text-sm">
                                    <tbody className="divide-y">
                                        {workingDays.map((item) => (
                                            <tr
                                                key={item.day}
                                                className="hover:bg-accent/50 transition-colors"
                                            >
                                                <td className="px-6 py-3 font-medium">
                                                    {translateDay(item.day)}
                                                </td>
                                                <td
                                                    dir="ltr"
                                                    className="px-6 py-3 text-muted-foreground text-start"
                                                >
                                                    <span className="inline-block whitespace-nowrap">
                                                        {formatTime(item.open)}{" "}
                                                        – {formatTime(item.close)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>
                </div>

                <div className="space-y-6">
                    <BookingPanel
                        doctorId={doctor.id}
                        fee={consultationFee}
                        active={doctor.active}
                    />
                </div>
            </div>
        </div>
    )
}
