
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cancelPendingAppointment } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
    Calendar,
    Clock,
    MapPin,
    User,
    Video,
    Plus,
    Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

export type AppointmentCard = {
    id: string
    doctor: string
    doctorAr: string
    specialty: string
    date: string
    time: string
    tab: "Upcoming" | "Completed" | "Cancelled" | "Missed"
    statusLabel: string
    type: "video" | "in-person"
    price: string
    cancellationReason?: string
}

const TABS = ["Upcoming", "Completed", "Cancelled", "Missed"] as const
const SPECIALTY_AR: Record<string, string> = {
    Cardiology: "أمراض القلب",
    Dermatology: "الأمراض الجلدية",
    Neurology: "طب الأعصاب",
    Pediatrics: "طب الأطفال",
    Orthopedics: "طب العظام",
    Gastroenterology: "أمراض الجهاز الهضمي",
    Psychiatry: "الطب النفسي",
    Ophthalmology: "طب العيون",
    ENT: "الأنف والأذن والحنجرة",
    "General Medicine": "الطب العام",
    Nutrition: "التغذية",
}

function formatAppointmentDate(date: string, language: "en" | "ar") {
    const parsedDate = new Date(`${date}T12:00:00Z`)

    return new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
        }
    ).format(parsedDate)
}

function formatAppointmentTime(time: string, language: "en" | "ar") {
    const match = time.match(
        /^(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?$/i
    )

    if (!match) return time

    const [, startHour, startMinute, startPeriod, endHour, endMinute, endPeriod] = match

    function formatOne(hour: string, minute: string, period?: string) {
        let hours = Number(hour)

        if (period?.toUpperCase() === "PM" && hours < 12) hours += 12
        if (period?.toUpperCase() === "AM" && hours === 12) hours = 0

        return new Intl.DateTimeFormat(
            language === "ar" ? "ar-LB" : "en-US",
            {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "UTC",
            }
        ).format(new Date(Date.UTC(2026, 0, 1, hours, Number(minute))))
    }

    return `${formatOne(startHour, startMinute, startPeriod)} – ${formatOne(endHour, endMinute, endPeriod)}`
} 
export function AppointmentsList({
    appointments,
}: {
    appointments: AppointmentCard[]
}) {
    const { language } = useLanguage()
    const router = useRouter()
const [isPending, startTransition] = useTransition()
const [cancellingId, setCancellingId] = useState<string | null>(null)

async function handleCancel(appointmentId: string) {
    const confirmed = window.confirm(
        language === "ar"
            ? "هل أنتِ متأكدة من إلغاء هذا الموعد؟"
            : "Are you sure you want to cancel this appointment?"
    )

    if (!confirmed) return

    setCancellingId(appointmentId)

    startTransition(async () => {
        try {
            const result = await cancelPendingAppointment(appointmentId)

            if (!result.success) {
                window.alert(
                    language === "ar"
                        ? "تعذّر إلغاء الموعد. يرجى تحديث الصفحة والمحاولة مجددًا."
                        : "Could not cancel the appointment. Please refresh and try again."
                )
                return
            }

            router.refresh()
        } catch {
            window.alert(
                language === "ar"
                    ? "حدث خطأ أثناء إلغاء الموعد."
                    : "An error occurred while cancelling the appointment."
            )
        } finally {
            setCancellingId(null)
        }
    })
}
    const [activeTab, setActiveTab] =
        useState<(typeof TABS)[number]>("Upcoming")

    const filtered = appointments.filter((a) => a.tab === activeTab)
    const countFor = (tab: (typeof TABS)[number]) =>
        appointments.filter((a) => a.tab === tab).length

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t(language, "My Appointments")}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {t(language, "Manage and track your medical visits.")}
                    </p>
                </div>

                <Link href="/doctors">
                    <Button className="shadow-lg shadow-blue-100 gap-2">
                        <Plus className="h-4 w-4" />
                        {t(language, "Book New Appointment")}
                    </Button>
                </Link>
            </div>

            <div className="flex flex-wrap bg-card/60 p-1 rounded-xl border-none shadow-sm w-fit">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-5 py-2 rounded-lg text-sm font-medium transition-all",
                            activeTab === tab
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t(language, tab)}
                        <span
                            className={cn(
                                "ms-2 text-xs",
                                activeTab === tab ? "opacity-80" : "opacity-60"
                            )}
                        >
                            {countFor(tab)}
                        </span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filtered.length > 0 ? (
                    filtered.map((app) => (
                        <Card
                            key={app.id}
                            className="border-none shadow-sm bg-card/60 overflow-hidden group hover:shadow-md transition-all"
                        >
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row items-stretch">
                                    <div
                                        className={cn(
                                            "w-full md:w-2 bg-primary",
                                            app.tab === "Completed" && "bg-emerald-500",
                                            app.tab === "Cancelled" && "bg-destructive",
                                            app.tab === "Missed" && "bg-orange-500"
                                        )}
                                    />

                                    <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center gap-6">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center border-2 border-background shadow-md shrink-0">
                                                <User className="h-8 w-8 text-primary" />
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-lg font-bold">
                                                        {language === "ar" && app.doctorAr
    ? app.doctorAr
    : app.doctor}
                                                    </h3>

                                                    <Badge
                                                        variant={
                                                            app.tab === "Upcoming"
                                                                ? "default"
                                                                : app.tab === "Completed"
                                                                ? "success"
                                                                : "destructive"
                                                        }
                                                    >
                                                        {t(language, app.statusLabel)}
                                                    </Badge>
                                                </div>

                                                <p className="text-primary text-sm font-medium">
                                                    {language === "ar"
    ? SPECIALTY_AR[app.specialty] ?? app.specialty
    : app.specialty}
                                                </p>

                                         
{app.tab === "Cancelled" && app.cancellationReason && (
    <p className="mt-2 text-sm text-destructive">
        {app.cancellationReason === "Cancelled by you"
            ? language === "ar"
                ? "تم إلغاء الموعد بواسطتك"
                : "Cancelled by you"
            : app.cancellationReason === "ai_assistant"
              ? language === "ar"
                  ? "تم إلغاء الموعد عبر المساعد الذكي"
                  : "Cancelled by AI assistant"
              : app.cancellationReason ===
                  "This appointment was cancelled because the doctor is currently unavailable. Please contact the clinic to reschedule."
                ? language === "ar"
                    ? "تم إلغاء هذا الموعد لأن الطبيب غير متاح حاليًا. يُرجى التواصل مع المركز لإعادة جدولة الموعد."
                    : app.cancellationReason
                : t(language, app.cancellationReason)}
    </p>
)}


                                                <div className="flex flex-wrap items-center mt-3 gap-x-6 gap-y-2 text-sm text-muted-foreground font-medium">
                                                    <div className="flex items-center">
                                                        <Calendar className="me-1.5 h-4 w-4 text-primary shrink-0" />
                                                        {formatAppointmentDate(app.date, language)}
                                                    </div>

                                                    <div className="flex items-center">
                                                        <Clock className="me-1.5 h-4 w-4 text-primary shrink-0" />
                                                        {formatAppointmentTime(app.time, language)}
                                                    </div>

                                                    <div className="flex items-center">
                                                        {app.type === "video" ? (
                                                            <Video className="me-1.5 h-4 w-4 text-blue-500 shrink-0" />
                                                        ) : (
                                                            <MapPin className="me-1.5 h-4 w-4 text-orange-500 shrink-0" />
                                                        )}

                                                        {t(
                                                            language,
                                                            app.type === "video"
                                                                ? "Video Call"
                                                                : "In-Person"
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                       <div className="flex items-center gap-3 md:justify-end">
    <span className="font-bold text-lg">
        {app.price}
    </span>

    {app.statusLabel === "Pending" && (
        <button
            type="button"
            onClick={() => handleCancel(app.id)}
            disabled={isPending}
            title={
                language === "ar"
                    ? "إلغاء الموعد"
                    : "Cancel appointment"
            }
            aria-label={
                language === "ar"
                    ? "إلغاء الموعد"
                    : "Cancel appointment"
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
            <Trash2 className="h-4 w-4" />
        </button>
    )}
</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="py-20 text-center animate-in fade-in slide-in-from-top-4">
                        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <Calendar className="h-10 w-10 text-muted-foreground" />
                        </div>

                        <h3 className="text-xl font-bold">
                            {t(language, "No appointments found")}
                        </h3>

                        <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
                            {t(
                                language,
                                "You don't have any appointments in this category. Why not book one today?"
                            )}
                        </p>

                        <Link href="/doctors">
                            <Button className="mt-8">
                                {t(language, "Book an Appointment")}
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
