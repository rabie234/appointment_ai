
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import {
    Search,
    Video,
    MapPin,
    LogIn,
    LogOut,
    Mail,
    Phone,
    AlertTriangle,
} from "lucide-react"

export type DoctorAppointment = {
    id: string
    patient: string
    patientEmail: string
    patientPhone: string
    date: string
    time: string
    endTime: string
    /** "YYYY-MM-DD HH:MM", for ordering. */
    sortKey: string
    tab: "today" | "upcoming" | "past"
    status:
        | "pending"
        | "confirmed"
        | "in-progress"
        | "completed"
        | "cancelled"
        | "missed"
    type: "video" | "in-person"
    notes: string
    startedAt?: string
    completedAt?: string
    cancellationReason: string
    clinicHoursConflict?: boolean
}

const TABS = [
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
] as const

const STATUS_LABEL: Record<DoctorAppointment["status"], string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    "in-progress": "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    missed: "Missed",
}

function badgeVariant(status: DoctorAppointment["status"]) {
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

function reasonText(reason: string, language: "en" | "ar"): string {
    if (reason === "Cancelled by you") {
        return t(language, "Cancelled by the patient")
    }

    if (reason === "ai_assistant") {
        return t(language, "Cancelled by the patient via the AI assistant")
    }

    return reason
}

function emptyMessage(
    appointmentsCount: number,
    searchTerm: string,
    tab: "today" | "upcoming" | "past",
    language: "en" | "ar"
): string {
    if (appointmentsCount === 0) {
        return t(language, "No appointments have been booked with you yet.")
    }

    if (searchTerm) {
        return t(language, "No appointments match your search.")
    }

    const key =
        tab === "today"
            ? "No appointments today."
            : tab === "upcoming"
                ? "No upcoming appointments."
                : "No past appointments."

    return t(language, key)
}

function formatCount(value: number, language: "en" | "ar"): string {
    return new Intl.NumberFormat(language === "ar" ? "ar-LB" : "en-US", {
        useGrouping: false,
    }).format(value)
}

function ClinicHoursWarning({ language }: { language: "en" | "ar" }) {
    return (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
                {language === "ar"
                    ? "هذا الموعد متأثر بتغيير ساعات عمل المركز. يرجى التواصل مع الإدارة أو المريض لتنسيق موعد بديل."
                    : "This appointment is affected by a change in clinic opening hours. Please contact the administration or patient to arrange an alternative appointment."}
            </p>
        </div>
    )
}

export function DoctorAppointmentsManager({
    doctorName,
    appointments,
}: {
    doctorName: string
    appointments: DoctorAppointment[]
}) {
    const { language } = useLanguage()
    const isArabic = language === "ar"
    const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("today")
    const [search, setSearch] = useState("")

    const term = search.trim().toLowerCase()
    const inTab = (key: string) =>
        appointments.filter((appointment) => appointment.tab === key)

    // Today and upcoming read soonest-first; history reads newest-first.
    const visible = inTab(tab)
        .filter(
            (appointment) =>
                !term ||
                appointment.patient.toLowerCase().includes(term) ||
                appointment.patientEmail.toLowerCase().includes(term)
        )
        .sort((a, b) =>
            tab === "past"
                ? b.sortKey.localeCompare(a.sortKey)
                : a.sortKey.localeCompare(b.sortKey)
        )

    return (
        <div
            dir={isArabic ? "rtl" : "ltr"}
            className="space-y-8 animate-in fade-in duration-500"
        >
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    {t(language, "My Appointments")}
                </h1>
                <p className="mt-1 text-muted-foreground">
                    {doctorName} · {t(language, "View-only schedule")}
                </p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex flex-wrap gap-2">
                    {TABS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setTab(item.key)}
                            className={cn(
                                "rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                                tab === item.key
                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                    : "border-transparent bg-card text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span className="inline-flex items-center gap-2">
                                {t(language, item.label)}
                                <span className="opacity-70">
                                    {formatCount(inTab(item.key).length, language)}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>

                <div className="relative w-full flex-1">
                    <Search
                        className={cn(
                            "absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
                            isArabic ? "right-3" : "left-3"
                        )}
                    />
                    <Input
                        placeholder={t(language, "Search by patient name or email...")}
                        className={cn(
                            "h-11 border-none bg-card shadow-sm",
                            isArabic ? "pr-10 text-right" : "pl-10"
                        )}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-2xl border bg-card/60 shadow-sm backdrop-blur-sm md:block">
                <Table>
                    <TableHeader>
                        <TableRow className="border-muted/50 bg-muted/30 hover:bg-transparent">
                            <TableHead className={cn("pl-6", isArabic && "text-center")}>
                                {t(language, "Patient")}
                            </TableHead>
                            <TableHead>{t(language, "Date & Time")}</TableHead>
                            <TableHead>{t(language, "Visit Type")}</TableHead>
                            <TableHead>{t(language, "Status")}</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {visible.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="py-12 text-center text-muted-foreground"
                                >
                                    {emptyMessage(
                                        appointments.length,
                                        term,
                                        tab,
                                        language
                                    )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            visible.map((appointment) => (
                                <TableRow
                                    key={appointment.id}
                                    className="group align-top border-muted/30 transition-colors hover:bg-accent/40"
                                >
                                    <TableCell className={cn("pl-6", isArabic && "text-center")}>
                                        <span className="block font-bold">
                                            {appointment.patient}
                                        </span>

                                        <span className="mt-0.5 flex flex-col items-center gap-0.5 text-xs text-muted-foreground">
                                            {appointment.patientEmail && (
                                                <span className="flex items-center justify-center gap-1">
                                                    <Mail className="h-3 w-3" />
                                                    {appointment.patientEmail}
                                                </span>
                                            )}

                                            {appointment.patientPhone && (
                                                <span className="flex items-center justify-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {appointment.patientPhone}
                                                </span>
                                            )}
                                        </span>

                                        {appointment.notes && (
                                            <p className="mt-1 max-w-xs text-xs italic text-muted-foreground">
                                                “{appointment.notes}”
                                            </p>
                                        )}
                                    </TableCell>

                                    <TableCell className="text-sm font-medium">
                                        <span className="block">
                                            {appointment.date}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {appointment.time} – {appointment.endTime}
                                        </span>

                                        {(appointment.startedAt || appointment.completedAt) && (
                                            <span className="mt-1 flex flex-col gap-0.5 text-[11px] font-normal text-muted-foreground">
                                                {appointment.startedAt && (
                                                    <span className="flex items-center gap-1">
                                                        <LogIn className="h-3 w-3 text-blue-500" />
                                                        {t(language, "Arrived")}{" "}
                                                        {appointment.startedAt}
                                                    </span>
                                                )}

                                                {appointment.completedAt && (
                                                    <span className="flex items-center gap-1">
                                                        <LogOut className="h-3 w-3 text-emerald-600" />
                                                        {t(language, "Left")}{" "}
                                                        {appointment.completedAt}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </TableCell>

                                    <TableCell>
                                        {appointment.type === "video" ? (
                                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-tighter text-blue-600">
                                                <Video className="h-3.5 w-3.5" />
                                                {t(language, "Tele-health")}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-tighter text-orange-600">
                                                <MapPin className="h-3.5 w-3.5" />
                                                {t(language, "In-Clinic")}
                                            </span>
                                        )}
                                    </TableCell>

                                    <TableCell>
                                        <Badge variant={badgeVariant(appointment.status)}>
                                            {t(language, STATUS_LABEL[appointment.status])}
                                        </Badge>

                                        {appointment.clinicHoursConflict && (
                                            <ClinicHoursWarning language={language} />
                                        )}

                                        {appointment.status === "cancelled" &&
                                            appointment.cancellationReason && (
                                                <p className="mt-1 max-w-[14rem] text-xs text-destructive">
                                                    {reasonText(
                                                        appointment.cancellationReason,
                                                        language
                                                    )}
                                                </p>
                                            )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
                {visible.length === 0 ? (
                    <p className="rounded-2xl border bg-card/60 py-12 text-center text-sm text-muted-foreground">
                        {emptyMessage(
                            appointments.length,
                            term,
                            tab,
                            language
                        )}
                    </p>
                ) : (
                    visible.map((appointment) => (
                        <div
                            key={appointment.id}
                            className="space-y-3 rounded-2xl border bg-card/60 p-4 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-bold">
                                        {appointment.patient}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {appointment.patientEmail}
                                    </p>
                                    {appointment.patientPhone && (
                                        <p className="text-xs text-muted-foreground">
                                            {appointment.patientPhone}
                                        </p>
                                    )}
                                </div>

                                <Badge variant={badgeVariant(appointment.status)}>
                                    {t(language, STATUS_LABEL[appointment.status])}
                                </Badge>
                            </div>

                            {appointment.clinicHoursConflict && (
                                <ClinicHoursWarning language={language} />
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="font-medium">
                                    {appointment.date} · {appointment.time} – {appointment.endTime}
                                </span>

                                <span
                                    className={cn(
                                        "flex items-center gap-1.5 text-xs font-bold uppercase tracking-tighter",
                                        appointment.type === "video"
                                            ? "text-blue-600"
                                            : "text-orange-600"
                                    )}
                                >
                                    {appointment.type === "video" ? (
                                        <Video className="h-3.5 w-3.5" />
                                    ) : (
                                        <MapPin className="h-3.5 w-3.5" />
                                    )}
                                    {t(
                                        language,
                                        appointment.type === "video"
                                            ? "Tele-health"
                                            : "In-Clinic"
                                    )}
                                </span>
                            </div>

                            {appointment.notes && (
                                <p className="text-xs italic text-muted-foreground">
                                    “{appointment.notes}”
                                </p>
                            )}

                            {appointment.status === "cancelled" &&
                                appointment.cancellationReason && (
                                    <p className="text-xs text-destructive">
                                        {reasonText(
                                            appointment.cancellationReason,
                                            language
                                        )}
                                    </p>
                                )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
