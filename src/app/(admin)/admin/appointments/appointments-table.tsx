
"use client"

import { useLanguage, type Language } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import { useState, useTransition, useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Check,
    X,
    User,
    Video,
    MapPin,
    CheckCheck,
    Loader2,
    Plus,
    PlayCircle,
    LogIn,
    LogOut,
} from "lucide-react"
import {
    confirmAppointment,
    startAppointment,
    completeAppointment,
    cancelAppointment,
    markAppointmentMissed,
    adminCreateAppointment,
    getDoctorSlots,
    type AppointmentActionState,
} from "./actions"

export type PatientOption = {
    id: string
    name: string
    email: string
}

export type DoctorOption = {
    id: string
    name: string
    nameAr: string
    specialty: string
    specialtyAr: string
}

export type AdminAppointment = {
    id: string
    patient: string
    doctor: string
    doctorNameAr: string
    specialty: string
    specialtyAr: string
    date: string
    scheduledDate: string
    time: string
    endTime: string
    status:
        | "pending"
        | "confirmed"
        | "in-progress"
        | "completed"
        | "cancelled"
        | "missed"
    type: "video" | "in-person"
    price: string
    startedAt?: string
    completedAt?: string
}

const FILTERS = [
    "All",
    "pending",
    "confirmed",
    "in-progress",
    "completed",
    "cancelled",
    "missed",
] as const

const STATUS_LABEL: Record<AdminAppointment["status"], string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    "in-progress": "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    missed: "missed",
}

function badgeVariant(status: AdminAppointment["status"]) {
    switch (status) {
        case "confirmed":
        case "in-progress":
            return "default" as const
        case "pending":
            return "secondary" as const
        case "completed":
            return "success" as const
        case "cancelled":
        case "missed":
            return "destructive" as const
    }
}

function formatAppointmentDate(date: string, language: Language) {
    const dateOnly = date.slice(0, 10)
    const parsed = new Date(`${dateOnly}T12:00:00Z`)

    return parsed.toLocaleDateString(
        language === "ar" ? "ar-LB" : "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        }
    )
}

type AppointmentsTableProps = {
    appointments: AdminAppointment[]
    patients: PatientOption[]
    doctors: DoctorOption[]
    initialSelectedAppointmentId?: string
    initialStatus?: string
}

export function AppointmentsTable({
    appointments,
    patients,
    doctors,
    initialSelectedAppointmentId,
    initialStatus,
}: AppointmentsTableProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(() => {
    if (
        initialStatus &&
        FILTERS.some((item) => item === initialStatus)
    ) {
        return initialStatus as (typeof FILTERS)[number]
    }

    return "All"
})

        useEffect(() => {
    if (!initialSelectedAppointmentId) return

    const selected = appointments.find(
        (appointment) => appointment.id === initialSelectedAppointmentId
    )

    if (!selected) return

    setFilter(selected.status)

    const timer = window.setTimeout(() => {
        document
            .getElementById(`appointment-${initialSelectedAppointmentId}`)
            ?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            })
    }, 100)

    return () => window.clearTimeout(timer)
}, [initialSelectedAppointmentId, appointments])
    const [createOpen, setCreateOpen] = useState(false)
    const { language } = useLanguage()
    const isArabic = language === "ar"

    const filtered =
        filter === "All"
            ? appointments
            : appointments.filter((appointment) => appointment.status === filter)

    const counts = appointments.reduce<Record<string, number>>((acc, appointment) => {
        acc[appointment.status] = (acc[appointment.status] ?? 0) + 1
        return acc
    }, {})

    return (
        <div
            dir={isArabic ? "rtl" : "ltr"}
            className="w-full min-w-0 space-y-6 animate-in fade-in duration-500"
        >
            {/* Page heading */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t(language, "Appointments Management")}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t(language, "Review, confirm, and cancel clinic appointments.")}
                    </p>
                </div>

                <Button
                    className="shrink-0 gap-2 shadow-sm"
                    onClick={() => setCreateOpen(true)}
                >
                    <Plus className="h-4 w-4" />
                    {t(language, "New Appointment")}
                </Button>
            </div>

            {/* Status filters */}
            <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => {
                    const count =
                        item === "All"
                            ? appointments.length
                            : counts[item] ?? 0

                    return (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setFilter(item)}
                            className={cn(
                                "inline-flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                filter === item
                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                    : "border-transparent bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                        >
                            <span>
                                {item === "All"
                                    ? t(language, "All")
                                    : t(language, STATUS_LABEL[item])}
                            </span>
                            <span className="text-xs opacity-75">{count}</span>
                        </button>
                    )
                })}
            </div>

            {/* Appointments table */}
            <div className="w-full overflow-x-auto rounded-xl border bg-card/60 shadow-sm">
                <Table
                    dir={isArabic ? "rtl" : "ltr"}
                    className="w-full min-w-[760px] table-auto"
                >
                    <TableHeader>
                        <TableRow className="border-muted/50 bg-muted/30 hover:bg-muted/30">
                            <TableHead className="whitespace-nowrap px-4 py-4 text-start">
                                {t(language, "Patient")}
                            </TableHead>

                            <TableHead className="whitespace-nowrap px-4 py-4 text-start">
                                {t(language, "Doctor")}
                            </TableHead>

                            <TableHead className="whitespace-nowrap px-4 py-4 text-start">
                                {t(language, "Service")}
                            </TableHead>

                            <TableHead className="whitespace-nowrap px-4 py-4 text-start">
                                {t(language, "Date & Time")}
                            </TableHead>

                            <TableHead className="whitespace-nowrap px-4 py-4 text-center">
                                {t(language, "Status")}
                            </TableHead>

                            <TableHead className="whitespace-nowrap px-4 py-4 text-center">
                                {t(language, "Quick Actions")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-12 text-center text-muted-foreground"
                                >
                                    {appointments.length === 0
                                        ? t(language, "No appointments yet.")
                                        : t(language, "No appointments in this category.")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((app) => (
                              <TableRow
    key={app.id}
    id={`appointment-${app.id}`}
    className={`border-muted/30 align-middle transition-colors hover:bg-accent/30 ${
        app.id === initialSelectedAppointmentId
            ? "bg-primary/10 ring-1 ring-inset ring-primary"
            : ""
    }`}
>
                                    {/* Patient */}
                                    <TableCell className="px-4 py-4 text-start">
                                        <span
                                            className="block max-w-[180px] truncate text-sm font-semibold"
                                            title={app.patient}
                                        >
                                            {app.patient}
                                        </span>
                                    </TableCell>

                                    {/* Doctor and specialty */}
                                    <TableCell className="px-4 py-4 text-start">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                            </div>

                                            <div className="min-w-0 leading-tight">
                                                <span className="block whitespace-nowrap text-sm font-semibold">
                                                    {isArabic
                                                        ? app.doctorNameAr || app.doctor
                                                        : app.doctor}
                                                </span>

                                                <span className="mt-1 block max-w-[190px] text-xs text-muted-foreground">
                                                    {isArabic
                                                        ? app.specialtyAr || app.specialty
                                                        : app.specialty}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Service */}
                                    <TableCell className="px-4 py-4 text-start">
                                        {app.type === "video" ? (
                                            <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-blue-600">
                                                <Video className="h-3.5 w-3.5 shrink-0" />
                                                <span>{t(language, "Tele-health")}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-orange-600">
                                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                <span>{t(language, "In-Clinic")}</span>
                                            </div>
                                        )}
                                    </TableCell>

                                    {/* Date, scheduled time, arrival and departure */}
                                    <TableCell className="px-4 py-4 text-start">
                                        <div className="flex min-w-[150px] flex-col items-start gap-1">
                                            <span className="whitespace-nowrap text-sm font-semibold text-foreground">
                                                {formatAppointmentDate(
                                                    app.scheduledDate,
                                                    language
                                                )}
                                            </span>

                                            <span
                                                dir="ltr"
                                                className="whitespace-nowrap text-sm text-muted-foreground"
                                            >
                                                {app.time} – {app.endTime}
                                            </span>

                                            {app.startedAt && (
                                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                    <LogIn className="h-3 w-3 shrink-0 text-blue-500" />
                                                    <span>
                                                        {t(language, "Arrived")} {app.startedAt}
                                                    </span>
                                                </span>
                                            )}

                                            {app.completedAt && (
                                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                    <LogOut className="h-3 w-3 shrink-0 text-emerald-600" />
                                                    <span>
                                                        {t(language, "Left")} {app.completedAt}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>

                                    {/* Status */}
                                    <TableCell className="px-4 py-4 text-center">
                                        <Badge variant={badgeVariant(app.status)}>
                                            {t(language, STATUS_LABEL[app.status])}
                                        </Badge>
                                    </TableCell>

                                    {/* Quick actions */}
                                    <TableCell className="px-4 py-4 text-center">
                                        <div className="flex justify-center">
                                            <RowActions app={app} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {createOpen && (
                <CreateDialog
                    patients={patients}
                    doctors={doctors}
                    onClose={() => setCreateOpen(false)}
                />
            )}
        </div>
    )
}

// ── New appointment dialog ──────────────────────────────────────────────────

function upcomingDays(count: number, language: Language) {
    const out: { value: string; label: string }[] = []
    const today = new Date()

    // Build date-only values using local calendar dates to avoid UTC day shifts.
    for (let i = 0; i < count; i++) {
        const day = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + i
        )

        const year = day.getFullYear()
        const month = String(day.getMonth() + 1).padStart(2, "0")
        const date = String(day.getDate()).padStart(2, "0")
        const value = `${year}-${month}-${date}`

        out.push({
            value,
            label: day.toLocaleDateString(
                language === "ar" ? "ar-LB" : "en-US",
                {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                }
            ),
        })
    }

    return out
}

function pretty(time: string, language: Language): string {
    const [hours, minutes] = time.split(":").map(Number)

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return time

    const date = new Date()
    date.setHours(hours, minutes, 0, 0)

    return date.toLocaleTimeString(
        language === "ar" ? "ar-LB" : "en-US",
        {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        }
    )
}

function CreateDialog({
    patients,
    doctors,
    onClose,
}: {
    patients: PatientOption[]
    doctors: DoctorOption[]
    onClose: () => void
}) {
    const { language } = useLanguage()
    const isArabic = language === "ar"
    const days = upcomingDays(14, language)

    const [patientId, setPatientId] = useState("")
    const [doctorId, setDoctorId] = useState("")
    const [date, setDate] = useState(days[0].value)
    const [time, setTime] = useState("")
    const [type, setType] = useState<"in-person" | "video">("in-person")
    const [slots, setSlots] = useState<string[]>([])
    const [loadingSlots, startLoadingSlots] = useTransition()

    const [state, formAction] = useActionState<
        AppointmentActionState,
        FormData
    >(adminCreateAppointment, {})

    useEffect(() => {
        if (!doctorId) {
            setSlots([])
            return
        }

        startLoadingSlots(async () => {
            const result = await getDoctorSlots(doctorId, date)
            setSlots(result.slots ?? [])
        })
    }, [doctorId, date])

    useEffect(() => {
        if (state.success) {
            onClose()
        }
    }, [state.success, onClose])

    function pickDoctor(value: string) {
        setTime("")
        setDoctorId(value)
    }

    function pickDate(value: string) {
        setTime("")
        setDate(value)
    }

    return (
        <div
            dir={isArabic ? "rtl" : "ltr"}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card shadow-xl animate-in zoom-in-95 duration-200"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b p-5">
                    <h2 className="text-lg font-bold">
                        {t(language, "New Appointment")}
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t(language, "Cancel")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form action={formAction} className="space-y-4 p-5">
                    <input type="hidden" name="date" value={date} />
                    <input type="hidden" name="time" value={time} />
                    <input type="hidden" name="type" value={type} />

                    {/* Patient */}
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">
                            {t(language, "Patient")}
                        </span>

                        <select
                            name="patientId"
                            value={patientId}
                            onChange={(event) => setPatientId(event.target.value)}
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="" disabled>
                                {t(language, "Select a patient")}
                            </option>

                            {patients.map((patient) => (
                                <option key={patient.id} value={patient.id}>
                                    {patient.name} — {patient.email}
                                </option>
                            ))}
                        </select>
                    </label>

                    {/* Doctor */}
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">
                            {t(language, "Doctor")}
                        </span>

                        <select
                            name="doctorId"
                            value={doctorId}
                            onChange={(event) => pickDoctor(event.target.value)}
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="" disabled>
                                {t(language, "Select a doctor")}
                            </option>

                            {doctors.map((doctor) => (
                                <option key={doctor.id} value={doctor.id}>
                                    {isArabic && doctor.nameAr
                                        ? doctor.nameAr
                                        : doctor.name}
                                    {" — "}
                                    {isArabic
                                        ? doctor.specialtyAr ||
                                          t(language, doctor.specialty)
                                        : doctor.specialty}
                                </option>
                            ))}
                        </select>
                    </label>

                    {/* Date and visit type */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">
                                {t(language, "Date")}
                            </span>

                            <select
                                value={date}
                                onChange={(event) => pickDate(event.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {days.map((day) => (
                                    <option key={day.value} value={day.value}>
                                        {day.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">
                                {t(language, "Visit Type")}
                            </span>

                            <select
                                value={type}
                                onChange={(event) =>
                                    setType(
                                        event.target.value as "in-person" | "video"
                                    )
                                }
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="in-person">
                                    {t(language, "In-Person")}
                                </option>
                                <option value="video">
                                    {t(language, "Video Call")}
                                </option>
                            </select>
                        </label>
                    </div>

                    {/* Available slots */}
                    <div className="space-y-2">
                        <span className="text-sm font-medium">
                            {t(language, "Time Slot")}
                        </span>

                        {!doctorId ? (
                            <p className="rounded-lg border py-4 text-center text-sm text-muted-foreground">
                                {t(language, "Select a doctor to see available times.")}
                            </p>
                        ) : loadingSlots ? (
                            <div className="flex items-center justify-center py-6 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : slots.length === 0 ? (
                            <p className="rounded-lg border py-4 text-center text-sm text-muted-foreground">
                                {t(language, "No available slots on this day.")}
                            </p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {slots.map((slot) => (
                                    <button
                                        type="button"
                                        key={slot}
                                        onClick={() => setTime(slot)}
                                        className={cn(
                                            "rounded-lg border px-2 py-2 text-xs transition-colors",
                                            time === slot
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "hover:border-primary hover:text-primary"
                                        )}
                                    >
                                        <span dir="ltr">
                                            {pretty(slot, language)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {state.error && (
                        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                            {state.error}
                        </p>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            {t(language, "Cancel")}
                        </Button>

                        <CreateSubmit
                            disabled={!patientId || !doctorId || !time}
                        />
                    </div>
                </form>
            </div>
        </div>
    )
}

function CreateSubmit({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus()
    const { language } = useLanguage()

    return (
        <Button
            type="submit"
            disabled={disabled || pending}
            className="gap-2 shadow-sm"
        >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t(language, "Create Appointment")}
        </Button>
    )
}

// ── Appointment actions ─────────────────────────────────────────────────────

function RowActions({ app }: { app: AdminAppointment }) {
    const { language } = useLanguage()
    const isArabic = language === "ar"
    const [pending, startTransition] = useTransition()
    const [showCancelForm, setShowCancelForm] = useState(false)
    const [cancellationReason, setCancellationReason] = useState("")

    const canConfirm = app.status === "pending"

    const canStart =
        app.status === "pending" || app.status === "confirmed"

    const canComplete = app.status === "in-progress"

    const canCancel =
        app.status === "pending" || app.status === "confirmed"

    const canMarkMissed =
        (app.status === "pending" || app.status === "confirmed") &&
        new Date(app.scheduledDate) < new Date()

    if (
        !canConfirm &&
        !canStart &&
        !canComplete &&
        !canCancel &&
        !canMarkMissed
    ) {
        return <span className="text-xs text-muted-foreground">—</span>
    }

    function run(
        action: () => Promise<{ error?: string; success?: boolean }>,
        confirmMessage?: string
    ) {
        if (confirmMessage && !window.confirm(confirmMessage)) return

        startTransition(async () => {
            const result = await action()

            if (result?.error) {
                window.alert(result.error)
            }
        })
    }

    return (
        <div
            dir={isArabic ? "rtl" : "ltr"}
            className="flex flex-wrap items-center justify-center gap-1.5"
        >
            {pending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}

            {canConfirm && (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={pending}
                    onClick={() => run(() => confirmAppointment(app.id))}
                    title={t(language, "Confirm")}
                    className="h-8 w-8 border-blue-100 text-blue-600 hover:bg-blue-50"
                >
                    <Check className="h-4 w-4" />
                </Button>
            )}

            {canStart && (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={pending}
                    onClick={() => run(() => startAppointment(app.id))}
                    title={t(language, "Start visit (patient arrived)")}
                    className="h-8 w-8 border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                >
                    <PlayCircle className="h-4 w-4" />
                </Button>
            )}

            {canComplete && (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={pending}
                    onClick={() => run(() => completeAppointment(app.id))}
                    title={t(language, "Complete visit (patient left)")}
                    className="h-8 w-8 border-emerald-100 text-emerald-600 hover:bg-emerald-50"
                >
                    <CheckCheck className="h-4 w-4" />
                </Button>
            )}

            {canCancel && (
                <>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={pending}
                        onClick={() =>
                            setShowCancelForm((previous) => !previous)
                        }
                        title={t(language, "Cancel")}
                        className="h-8 w-8 border-red-100 text-destructive hover:bg-red-50"
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    {showCancelForm && (
                        <div className="absolute z-20 mt-2 flex min-w-64 flex-col gap-2 rounded-lg border bg-card p-3 text-start shadow-lg">
                            <label className="text-sm font-medium">
                                {t(language, "Cancellation Comment (Optional)")}
                            </label>

                            <textarea
                                value={cancellationReason}
                                onChange={(event) =>
                                    setCancellationReason(event.target.value)
                                }
                                placeholder={t(
                                    language,
                                    "Enter the reason for cancellation..."
                                )}
                                rows={3}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={pending}
                                    onClick={() => setShowCancelForm(false)}
                                >
                                    {t(language, "Back")}
                                </Button>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    disabled={pending}
                                    onClick={() =>
                                        run(
                                            () =>
                                                cancelAppointment(
                                                    app.id,
                                                    cancellationReason
                                                ),
                                            t(
                                                language,
                                                "Confirm cancellation for this appointment?"
                                            )
                                        )
                                    }
                                >
                                    {t(language, "Confirm Cancellation")}
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {canMarkMissed && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                        run(
                            () => markAppointmentMissed(app.id),
                            t(
                                language,
                                "Confirm that this patient did not attend the appointment?"
                            )
                        )
                    }
                    title={t(language, "Mark as missed")}
                >
                    {t(language, "Mark Missed")}
                </Button>
            )}
        </div>
    )
}
