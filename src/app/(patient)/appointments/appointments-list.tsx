
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    cancelPendingAppointment,
    cancelLeaveConflictAppointment,
    rescheduleLeaveConflictAppointment,
} from "./actions"
import { getAvailableSlots } from "../doctors/[id]/actions"
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
    AlertTriangle,
    RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

export type AppointmentCard = {
    id: string
    doctorId: string
    leaveConflict: boolean
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

    return new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(parsedDate)
}

function formatAppointmentTime(time: string, language: "en" | "ar") {
    const match = time.match(
        /^(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?$/i
    )

    if (!match) return time

    const [, startHour, startMinute, startPeriod, endHour, endMinute, endPeriod] =
        match

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

    return `${formatOne(startHour, startMinute, startPeriod)} – ${formatOne(
        endHour,
        endMinute,
        endPeriod
    )}`
}

type SlotResponse = {
    slots?: string[]
    availableSlots?: string[]
    onLeave?: boolean
    success?: boolean
    message?: string
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
    const [reschedulingId, setReschedulingId] = useState<string | null>(null)
    const [selectedDate, setSelectedDate] = useState("")
    const [selectedTime, setSelectedTime] = useState("")
    const [availableSlots, setAvailableSlots] = useState<string[]>([])
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [savingReschedule, setSavingReschedule] = useState(false)
    const [message, setMessage] = useState("")
    const [activeTab, setActiveTab] =
        useState<(typeof TABS)[number]>("Upcoming")

    const isArabic = language === "ar"

    async function handleCancel(appointmentId: string) {
        const confirmed = window.confirm(
            isArabic
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
                        isArabic
                            ? "تعذّر إلغاء الموعد. يرجى تحديث الصفحة والمحاولة مجددًا."
                            : "Could not cancel the appointment. Please refresh and try again."
                    )
                    return
                }

                router.refresh()
            } catch {
                window.alert(
                    isArabic
                        ? "حدث خطأ أثناء إلغاء الموعد."
                        : "An error occurred while cancelling the appointment."
                )
            } finally {
                setCancellingId(null)
            }
        })
    }

    async function handleCancelLeaveConflict(appointmentId: string) {
        const confirmed = window.confirm(
            isArabic
                ? "هل تريدين إلغاء هذا الموعد المتأثر بإجازة الطبيب؟"
                : "Cancel this appointment affected by the doctor's leave?"
        )

        if (!confirmed) return

        setCancellingId(appointmentId)

        try {
            const result = await cancelLeaveConflictAppointment(appointmentId)

            if (!result.success) {
                window.alert(
                    result.message ||
                        (isArabic
                            ? "تعذّر إلغاء الموعد."
                            : "Could not cancel the appointment.")
                )
                return
            }

            setReschedulingId(null)
            router.refresh()
        } catch {
            window.alert(
                isArabic
                    ? "حدث خطأ أثناء إلغاء الموعد."
                    : "An error occurred while cancelling the appointment."
            )
        } finally {
            setCancellingId(null)
        }
    }

    function openReschedule(appointment: AppointmentCard) {
        setReschedulingId(appointment.id)
        setSelectedDate("")
        setSelectedTime("")
        setAvailableSlots([])
        setMessage("")
    }

    function closeReschedule() {
        setReschedulingId(null)
        setSelectedDate("")
        setSelectedTime("")
        setAvailableSlots([])
        setMessage("")
    }

    async function loadAvailableSlots(appointment: AppointmentCard) {
        if (!selectedDate) {
            setMessage(
                isArabic ? "يرجى اختيار التاريخ أولاً." : "Please select a date first."
            )
            return
        }

        setLoadingSlots(true)
        setSelectedTime("")
        setAvailableSlots([])
        setMessage("")

        try {
            const result = (await getAvailableSlots(
                appointment.doctorId,
                selectedDate
            )) as SlotResponse

            if (result.onLeave) {
                setMessage(
                    isArabic
                        ? "الطبيب في إجازة في هذا التاريخ. اختاري تاريخاً آخر."
                        : "The doctor is on leave on this date. Please choose another date."
                )
                return
            }

            const slots = result.slots ?? result.availableSlots ?? []
            setAvailableSlots(slots)

            if (slots.length === 0) {
                setMessage(
                    isArabic
                        ? "لا توجد أوقات متاحة في هذا التاريخ."
                        : "No available time slots on this date."
                )
            }
        } catch {
            setMessage(
                isArabic
                    ? "تعذّر تحميل الأوقات المتاحة. حاولي مجدداً."
                    : "Could not load available times. Please try again."
            )
        } finally {
            setLoadingSlots(false)
        }
    }

    async function saveReschedule(appointmentId: string) {
        if (!selectedDate || !selectedTime) {
            setMessage(
                isArabic
                    ? "اختاري التاريخ والوقت المتاحين."
                    : "Please select a date and an available time."
            )
            return
        }

        setSavingReschedule(true)
        setMessage("")

        try {
            const result = await rescheduleLeaveConflictAppointment(
                appointmentId,
                selectedDate,
                selectedTime
            )

            if (!result.success) {
                setMessage(
                    result.message ||
                        (isArabic
                            ? "تعذّرت إعادة جدولة الموعد."
                            : "Could not reschedule the appointment.")
                )
                return
            }

            window.alert(
                isArabic
                    ? "تمت إعادة جدولة الموعد بنجاح."
                    : "Appointment rescheduled successfully."
            )

            closeReschedule()
            router.refresh()
        } catch {
            setMessage(
                isArabic
                    ? "حدث خطأ أثناء إعادة جدولة الموعد."
                    : "An error occurred while rescheduling."
            )
        } finally {
            setSavingReschedule(false)
        }
    }

    const filtered = appointments.filter(
        (appointment) => appointment.tab === activeTab
    )

    const countFor = (tab: (typeof TABS)[number]) =>
        appointments.filter((appointment) => appointment.tab === tab).length

    const today = new Date()
    const minimumDate = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
    ].join("-")

    return (
        <div className="animate-in fade-in space-y-8 duration-500">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t(language, "My Appointments")}
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        {t(language, "Manage and track your medical visits.")}
                    </p>
                </div>

                <Link href="/doctors">
                    <Button className="gap-2 shadow-lg shadow-blue-100">
                        <Plus className="h-4 w-4" />
                        {t(language, "Book New Appointment")}
                    </Button>
                </Link>
            </div>

            <div className="flex w-fit flex-wrap rounded-xl bg-card/60 p-1 shadow-sm">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "rounded-lg px-5 py-2 text-sm font-medium transition-all",
                            activeTab === tab
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t(language, tab)}
                        <span className="ms-2 text-xs opacity-80">
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
                            className="group overflow-hidden border-none bg-card/60 shadow-sm transition-all hover:shadow-md"
                        >
                            <CardContent className="p-0">
                                <div className="flex flex-col items-stretch md:flex-row">
                                    <div
                                        className={cn(
                                            "w-full bg-primary md:w-2",
                                            app.tab === "Completed" && "bg-emerald-500",
                                            app.tab === "Cancelled" && "bg-destructive",
                                            app.tab === "Missed" && "bg-orange-500",
                                            app.leaveConflict &&
                                                app.tab === "Upcoming" &&
                                                "bg-destructive"
                                        )}
                                    />

                                    <div className="flex flex-1 flex-col gap-6 p-6 md:flex-row md:items-center">
                                        <div className="flex flex-1 items-center gap-4">
                                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-background bg-muted shadow-md">
                                                <User className="h-8 w-8 text-primary" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-lg font-bold">
                                                        {isArabic && app.doctorAr
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

                                                    {app.leaveConflict &&
                                                        app.tab === "Upcoming" && (
                                                            <Badge
                                                                variant="destructive"
                                                                className="gap-1"
                                                            >
                                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                                {isArabic
                                                                    ? "تنبيه: إجازة الطبيب"
                                                                    : "Doctor Leave Alert"}
                                                            </Badge>
                                                        )}
                                                </div>

                                                <p className="text-sm font-medium text-primary">
                                                    {isArabic
                                                        ? SPECIALTY_AR[app.specialty] ??
                                                          app.specialty
                                                        : app.specialty}
                                                </p>

                                                {app.tab === "Cancelled" &&
                                                    app.cancellationReason && (
                                                        <p className="mt-2 text-sm text-destructive">
                                                            {app.cancellationReason ===
                                                            "Cancelled by you"
                                                                ? isArabic
                                                                    ? "تم إلغاء الموعد بواسطتك"
                                                                    : "Cancelled by you"
                                                                : app.cancellationReason ===
                                                                    "ai_assistant"
                                                                  ? isArabic
                                                                      ? "تم إلغاء الموعد عبر المساعد الذكي"
                                                                      : "Cancelled by AI assistant"
                                                                  : app.cancellationReason}
                                                        </p>
                                                    )}

                                                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
                                                    <div className="flex items-center">
                                                        <Calendar className="me-1.5 h-4 w-4 shrink-0 text-primary" />
                                                        {formatAppointmentDate(
                                                            app.date,
                                                            language
                                                        )}
                                                    </div>

                                                    <div className="flex items-center">
                                                        <Clock className="me-1.5 h-4 w-4 shrink-0 text-primary" />
                                                        {formatAppointmentTime(
                                                            app.time,
                                                            language
                                                        )}
                                                    </div>

                                                    <div className="flex items-center">
                                                        {app.type === "video" ? (
                                                            <Video className="me-1.5 h-4 w-4 shrink-0 text-blue-500" />
                                                        ) : (
                                                            <MapPin className="me-1.5 h-4 w-4 shrink-0 text-orange-500" />
                                                        )}
                                                        {t(
                                                            language,
                                                            app.type === "video"
                                                                ? "Video Call"
                                                                : "In-Person"
                                                        )}
                                                    </div>
                                                </div>

                                                {app.leaveConflict &&
                                                    app.tab === "Upcoming" && (
                                                        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                                                            <p className="text-sm text-destructive">
                                                                {isArabic
                                                                    ? "هذا الموعد متأثر بإجازة الطبيب. يمكنك اختيار موعد آخر متاح أو إلغاء الموعد."
                                                                    : "This appointment is affected by the doctor's leave. Choose another available time or cancel the appointment."}
                                                            </p>

                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                   onClick={() =>
    router.push(
        `/doctors/${app.doctorId}?rescheduleAppointmentId=${app.id}`
    )
}
                                                                >
                                                                    <RefreshCw className="me-2 h-4 w-4" />
                                                                    {reschedulingId === app.id
                                                                        ? isArabic
                                                                            ? "إغلاق"
                                                                            : "Close"
                                                                        : isArabic
                                                                          ? "إعادة جدولة"
                                                                          : "Reschedule"}
                                                                </Button>

                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    disabled={
                                                                        isPending ||
                                                                        cancellingId === app.id
                                                                    }
                                                                    onClick={() =>
                                                                        handleCancelLeaveConflict(
                                                                            app.id
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2 className="me-2 h-4 w-4" />
                                                                    {isArabic
                                                                        ? "إلغاء الموعد"
                                                                        : "Cancel appointment"}
                                                                </Button>
                                                            </div>

                                                            {reschedulingId === app.id && (
                                                                <div className="mt-4 space-y-3 border-t border-destructive/20 pt-4">
                                                                    <label className="block text-sm font-medium">
                                                                        {isArabic
                                                                            ? "اختاري تاريخاً جديداً"
                                                                            : "Choose a new date"}
                                                                    </label>

                                                                    <div className="flex flex-col gap-2 sm:flex-row">
                                                                        <input
                                                                            type="date"
                                                                            min={minimumDate}
                                                                            value={selectedDate}
                                                                            onChange={(event) => {
                                                                                setSelectedDate(
                                                                                    event.target.value
                                                                                )
                                                                                setSelectedTime("")
                                                                                setAvailableSlots([])
                                                                                setMessage("")
                                                                            }}
                                                                            className="h-10 rounded-md border bg-background px-3 text-sm"
                                                                        />

                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            disabled={
                                                                                loadingSlots ||
                                                                                !selectedDate
                                                                            }
                                                                            onClick={() =>
                                                                                loadAvailableSlots(
                                                                                    app
                                                                                )
                                                                            }
                                                                        >
                                                                            {loadingSlots
                                                                                ? isArabic
                                                                                    ? "جارٍ التحميل..."
                                                                                    : "Loading..."
                                                                                : isArabic
                                                                                  ? "عرض الأوقات المتاحة"
                                                                                  : "Load available times"}
                                                                        </Button>
                                                                    </div>

                                                                    {availableSlots.length > 0 && (
                                                                        <>
                                                                            <label className="block text-sm font-medium">
                                                                                {isArabic
                                                                                    ? "اختاري وقتاً متاحاً"
                                                                                    : "Choose an available time"}
                                                                            </label>

                                                                            <select
                                                                                value={selectedTime}
                                                                                onChange={(event) =>
                                                                                    setSelectedTime(
                                                                                        event.target.value
                                                                                    )
                                                                                }
                                                                                className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:max-w-xs"
                                                                            >
                                                                                <option value="">
                                                                                    {isArabic
                                                                                        ? "اختيار الوقت"
                                                                                        : "Select a time"}
                                                                                </option>
                                                                                {availableSlots.map(
                                                                                    (slot) => (
                                                                                        <option
                                                                                            key={slot}
                                                                                            value={slot}
                                                                                        >
                                                                                            {slot}
                                                                                        </option>
                                                                                    )
                                                                                )}
                                                                            </select>

                                                                            <Button
                                                                                type="button"
                                                                                disabled={
                                                                                    savingReschedule ||
                                                                                    !selectedTime
                                                                                }
                                                                                onClick={() =>
                                                                                    saveReschedule(
                                                                                        app.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                {savingReschedule
                                                                                    ? isArabic
                                                                                        ? "جارٍ الحفظ..."
                                                                                        : "Saving..."
                                                                                    : isArabic
                                                                                      ? "تأكيد الموعد الجديد"
                                                                                      : "Confirm new appointment"}
                                                                            </Button>
                                                                        </>
                                                                    )}

                                                                    {message && (
                                                                        <p
                                                                            role="status"
                                                                            className="text-sm text-destructive"
                                                                        >
                                                                            {message}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 md:justify-end">
                                            <span className="text-lg font-bold">
                                                {app.price}
                                            </span>

                                            {app.statusLabel === "Pending" &&
                                                !app.leaveConflict && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleCancel(app.id)
                                                        }
                                                        disabled={
                                                            isPending ||
                                                            cancellingId === app.id
                                                        }
                                                        title={
                                                            isArabic
                                                                ? "إلغاء الموعد"
                                                                : "Cancel appointment"
                                                        }
                                                        aria-label={
                                                            isArabic
                                                                ? "إلغاء الموعد"
                                                                : "Cancel appointment"
                                                        }
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
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
                    <div className="animate-in fade-in slide-in-from-top-4 py-20 text-center">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                            <Calendar className="h-10 w-10 text-muted-foreground" />
                        </div>

                        <h3 className="text-xl font-bold">
                            {t(language, "No appointments found")}
                        </h3>

                        <p className="mx-auto mt-2 max-w-xs text-muted-foreground">
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
