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

export type PatientOption = { id: string; name: string; email: string }
export type DoctorOption = {
    id: string
    name: string
    nameAr: string
    specialty: string
}

export type AdminAppointment = {
    id: string
    patient: string
    doctor: string
    doctorNameAr: string
    specialty: string
    date: string
    scheduledDate: string
    /** Scheduled start and end of the slot, already formatted (e.g. "9:00 AM"). */
    time: string
    endTime: string
    status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled" | "missed"
    type: "video" | "in-person"
    price: string
    /** Actual check-in / check-out times, once the admin marks them. */
    startedAt?: string
    completedAt?: string
}

const FILTERS = ["All", "pending", "confirmed", "in-progress", "completed", "cancelled", "missed"] as const
const STATUS_LABEL: Record<AdminAppointment["status"], string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    "in-progress": "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    missed:"missed",
}

function badgeVariant(status: AdminAppointment["status"]) {
    switch (status) {
        case "confirmed":
            return "default" as const
        case "in-progress":
            return "default" as const
        case "pending":
            return "secondary" as const
        case "completed":
            return "success" as const
        case "cancelled":
            return "destructive" as const
            case "missed":
    return "destructive"
    }
}

export function AppointmentsTable({
    appointments,
    patients,
    doctors,
}: {
    appointments: AdminAppointment[]
    patients: PatientOption[]
    doctors: DoctorOption[]
}) {
    const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All")
    const [createOpen, setCreateOpen] = useState(false)
    const { language } = useLanguage()
    const isArabic = language === "ar"
    const filtered = filter === "All" ? appointments : appointments.filter((a) => a.status === filter)

    const counts = appointments.reduce<Record<string, number>>((acc, a) => {
        acc[a.status] = (acc[a.status] ?? 0) + 1
        return acc
    }, {})

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight"> {t(language, "Appointments Management")}</h1>
                    <p className="text-muted-foreground mt-1">{t(language, "Review, confirm, and cancel clinic appointments.")}</p>
                </div>
                <Button className="shadow-lg shadow-blue-100 gap-2" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t(language, "New Appointment")}
                </Button>
            </div>

            {/* Status filter */}
            <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => {
                    const count = f === "All" ? appointments.length : counts[f] ?? 0
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                               "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
isArabic ? "flex-row-reverse" : "",
                                filter === f
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-card border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {f === "All"
    ? t(language, "All")
    : t(language, STATUS_LABEL[f])}
                            <span className="ml-2 opacity-70">{count}</span>
                        </button>
                    )
                })}
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-muted/50 bg-muted/30">
                           <TableHead className="pl-6">{t(language, "Patient")}</TableHead>
<TableHead>{t(language, "Doctor")}</TableHead>
<TableHead>{t(language, "Service")}</TableHead>
<TableHead>{t(language, "Date & Time")}</TableHead>
<TableHead>{t(language, "Status")}</TableHead>
<TableHead className="text-right pr-6">
    {t(language, "Quick Actions")}
</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                   {appointments.length === 0
    ? t(language, "No appointments yet.")
    : t(language, "No appointments in this category.")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((app) => (
                                <TableRow key={app.id} className="group hover:bg-accent/40 transition-colors border-muted/30">
                                    <TableCell className="pl-6 font-bold">{app.patient}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="leading-tight">
                                                <span className="text-sm font-semibold block">{app.doctor}</span>
                                                <span className="text-xs text-muted-foreground">{app.specialty}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {app.type === "video" ? (
                                            <div className="flex items-center gap-1.5 text-blue-600 text-xs font-bold uppercase tracking-tighter">
                                                <Video className="h-3.5 w-3.5" />
                                                <span>{t(language, "Tele-health")}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-orange-600 text-xs font-bold uppercase tracking-tighter">
                                                <MapPin className="h-3.5 w-3.5" />
                                                <span>{t(language, "In-Clinic")}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">
                                        <div>
                                            <span className="text-foreground">{app.date}</span>
                                            <span className="text-muted-foreground ml-2">{app.time} – {app.endTime}</span>
                                        </div>
                                        {(app.startedAt || app.completedAt) && (
                                            <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-muted-foreground font-normal">
                                                {app.startedAt && (
                                                    <span className="flex items-center gap-1">
                                                        <LogIn className="h-3 w-3 text-blue-500" /> {t(language, "Arrived")} {app.startedAt}
                                                    </span>
                                                )}
                                                {app.completedAt && (
                                                    <span className="flex items-center gap-1">
                                                        <LogOut className="h-3 w-3 text-emerald-600" /> {t(language, "Left")} {app.completedAt}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={badgeVariant(app.status)}>
    {t(language, STATUS_LABEL[app.status])}
</Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <RowActions app={app} />
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

// ── New-appointment dialog ──────────────────────────────────────────────────

function upcomingDays(count: number, language: Language) {
    const out: { value: string; label: string }[] = []
    const today = new Date()
    for (let i = 0; i < count; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        out.push({
            value: d.toISOString().slice(0, 10),
            label: d.toLocaleDateString(
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

function pretty(time: string): string {
    const [h, m] = time.split(":").map(Number)
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`
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
    const days = upcomingDays(14, language)
    const [patientId, setPatientId] = useState("")
    const [doctorId, setDoctorId] = useState("")
    const [date, setDate] = useState(days[0].value)
    const [time, setTime] = useState("")
    const [type, setType] = useState<"in-person" | "video">("in-person")

    const [slots, setSlots] = useState<string[]>([])
    const [loadingSlots, startLoadingSlots] = useTransition()

    const [state, formAction] = useActionState<AppointmentActionState, FormData>(
        adminCreateAppointment,
        {}
    )

    // Fetch free slots whenever a doctor is selected or the date changes. The
    // doctor `<select>` has no re-selectable empty option, so once set it stays
    // set — no need to clear slots back to [] here.
    useEffect(() => {
        if (!doctorId) return
        startLoadingSlots(async () => {
            const res = await getDoctorSlots(doctorId, date)
            setSlots(res.slots ?? [])
        })
    }, [doctorId, date])

    useEffect(() => {
        if (state.success) onClose()
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-2xl border bg-card shadow-xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b p-5">
                    <h2 className="text-lg font-bold">
    {t(language, "New Appointment")}
</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form action={formAction} className="space-y-4 p-5">
                    <input type="hidden" name="date" value={date} />
                    <input type="hidden" name="time" value={time} />
                    <input type="hidden" name="type" value={type} />

                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">
    {t(language, "Patient")}
</span>
                        <select
                            name="patientId"
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="" disabled>
    {t(language, "Select a patient")}
</option>
                            {patients.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} — {p.email}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">{t(language, "Doctor")}</span>
                        <select
                            name="doctorId"
                            value={doctorId}
                            onChange={(e) => pickDoctor(e.target.value)}
                            required
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="" disabled>
    {t(language, "Select a doctor")}
</option>
                            {doctors.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {language === "ar" && d.nameAr
    ? d.nameAr
    : d.name} — {language === "ar"
    ? t(language, d.specialty)
    : d.specialty}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">
    {t(language, "Date")}
</span>
                            <select
                                value={date}
                                onChange={(e) => pickDate(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {days.map((d) => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">
    {t(language, "Visit Type")}
</span>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as "in-person" | "video")}
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

                    <div className="space-y-2">
                        <span className="text-sm font-medium">
    {t(language, "Time Slot")}
</span>
                        {!doctorId ? (
                            <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
    {t(language, "Select a doctor to see available times.")}
</p>
                        ) : loadingSlots ? (
                            <div className="flex items-center justify-center py-6 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : slots.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                               {t(language, "No available slots on this day.")}

                            </p>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {slots.map((s) => (
                                    <button
                                        type="button"
                                        key={s}
                                        onClick={() => setTime(s)}
                                        className={cn(
                                            "px-2 py-2 text-xs rounded-lg border transition-all",
                                            time === s
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "hover:border-primary hover:text-primary"
                                        )}
                                    >
                                        {pretty(s)}
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
                        <CreateSubmit disabled={!patientId || !doctorId || !time} />
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
            className="gap-2 shadow-lg shadow-blue-200"
        >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t(language, "Create Appointment")}
        </Button>
    )
}
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
        fn: () => Promise<{ error?: string }>,
        confirmMsg?: string
    ) {
        if (confirmMsg && !window.confirm(confirmMsg)) return

        startTransition(async () => {
            const res = await fn()
            if (res?.error) window.alert(res.error)
        })
    }

    return (
        <div
            className={`flex justify-end gap-1.5 ${
                isArabic ? "flex-row-reverse" : ""
            }`}
            dir={isArabic ? "rtl" : "ltr"}
        >
            {pending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />
            )}

            {canConfirm && (
                <Button
                    variant="outline"
                    size="icon"
                    disabled={pending}
                    onClick={() => run(() => confirmAppointment(app.id))}
                    title={t(language, "Confirm")}
                    className="h-8 w-8 text-blue-600 border-blue-100 hover:bg-blue-50"
                >
                    <Check className="h-4 w-4" />
                </Button>
            )}

            {canStart && (
                <Button
                    variant="outline"
                    size="icon"
                    disabled={pending}
                    onClick={() => run(() => startAppointment(app.id))}
                    title={t(language, "Start visit (patient arrived)")}
                    className="h-8 w-8 text-indigo-600 border-indigo-100 hover:bg-indigo-50"
                >
                    <PlayCircle className="h-4 w-4" />
                </Button>
            )}

            {canComplete && (
                <Button
                    variant="outline"
                    size="icon"
                    disabled={pending}
                    onClick={() => run(() => completeAppointment(app.id))}
                    title={t(language, "Complete visit (patient left)")}
                    className="h-8 w-8 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                >
                    <CheckCheck className="h-4 w-4" />
                </Button>
            )}

            {canCancel && (
                <>
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={pending}
                        onClick={() =>
                            setShowCancelForm((prev) => !prev)
                        }
                        title={t(language, "Cancel")}
                        className="h-8 w-8 text-destructive border-red-100 hover:bg-red-50"
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    {showCancelForm && (
                        <div className="flex flex-col gap-2 min-w-64 text-left">
                            <label className="text-sm font-medium">
                                {t(language, "Cancellation Comment (Optional)")}
                            </label>

                            <textarea
                                value={cancellationReason}
                                onChange={(e) =>
                                    setCancellationReason(e.target.value)
                                }
                                placeholder={t(
                                    language,
                                    "Enter the reason for cancellation..."
                                )}
                                rows={3}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />

                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={pending}
                                    onClick={() => setShowCancelForm(false)}
                                >
                                    {t(language, "Back")}
                                </Button>

                                <Button
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
