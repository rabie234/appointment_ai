"use client"

import { useState, useTransition } from "react"
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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    Check,
    X,
    Search,
    Video,
    MapPin,
    CheckCheck,
    Loader2,
    PlayCircle,
    UserX,
    LogIn,
    LogOut,
    Mail,
    Phone,
} from "lucide-react"
import {
    doctorConfirmAppointment,
    doctorStartAppointment,
    doctorCompleteAppointment,
    doctorCancelAppointment,
    doctorMarkMissed,
    type DoctorAppointmentState,
} from "./actions"

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
    status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled" | "missed"
    type: "video" | "in-person"
    notes: string
    startedAt?: string
    completedAt?: string
    cancellationReason: string
    canMarkMissed: boolean
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

/** Patients cancel through the app too; show those reasons as people-readable text. */
function reasonText(reason: string): string {
    if (reason === "Cancelled by you") return "Cancelled by the patient"
    if (reason === "ai_assistant") return "Cancelled by the patient via the AI assistant"
    return reason
}

export function DoctorAppointmentsManager({
    doctorName,
    appointments,
}: {
    doctorName: string
    appointments: DoctorAppointment[]
}) {
    const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("today")
    const [search, setSearch] = useState("")

    const term = search.trim().toLowerCase()
    const inTab = (key: string) => appointments.filter((a) => a.tab === key)
    // Today and upcoming read soonest-first; history reads newest-first.
    const visible = inTab(tab)
        .filter((a) => !term || a.patient.toLowerCase().includes(term) || a.patientEmail.toLowerCase().includes(term))
        .sort((a, b) => (tab === "past" ? b.sortKey.localeCompare(a.sortKey) : a.sortKey.localeCompare(b.sortKey)))

    const needsAction = appointments.filter((a) => a.status === "pending").length

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">My Appointments</h1>
                <p className="text-muted-foreground mt-1">
                    {doctorName} · {needsAction > 0 ? `${needsAction} waiting for your confirmation.` : "Nothing is waiting for confirmation."}
                </p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 md:items-center">
                <div className="flex flex-wrap gap-2">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                                tab === t.key
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-card border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t.label}
                            <span className="ml-2 opacity-70">{inTab(t.key).length}</span>
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by patient name or email..."
                        className="pl-10 h-11 bg-card border-none shadow-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="hidden md:block bg-card/60 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-muted/50 bg-muted/30">
                            <TableHead className="pl-6">Patient</TableHead>
                            <TableHead>Date &amp; Time</TableHead>
                            <TableHead>Visit</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visible.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                    {appointments.length === 0
                                        ? "No appointments have been booked with you yet."
                                        : term
                                            ? "No appointments match your search."
                                            : `No ${tab === "today" ? "appointments today" : tab === "upcoming" ? "upcoming appointments" : "past appointments"}.`}
                                </TableCell>
                            </TableRow>
                        ) : (
                            visible.map((app) => (
                                <TableRow key={app.id} className="group hover:bg-accent/40 transition-colors border-muted/30 align-top">
                                    <TableCell className="pl-6">
                                        <span className="font-bold block">{app.patient}</span>
                                        <span className="mt-0.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
                                            {app.patientEmail && (
                                                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{app.patientEmail}</span>
                                            )}
                                            {app.patientPhone && (
                                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{app.patientPhone}</span>
                                            )}
                                        </span>
                                        {app.notes && <p className="mt-1 max-w-xs text-xs italic text-muted-foreground">“{app.notes}”</p>}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">
                                        <span className="block">{app.date}</span>
                                        <span className="text-muted-foreground">{app.time} – {app.endTime}</span>
                                        {(app.startedAt || app.completedAt) && (
                                            <span className="mt-1 flex flex-col gap-0.5 text-[11px] text-muted-foreground font-normal">
                                                {app.startedAt && (
                                                    <span className="flex items-center gap-1"><LogIn className="h-3 w-3 text-blue-500" /> Arrived {app.startedAt}</span>
                                                )}
                                                {app.completedAt && (
                                                    <span className="flex items-center gap-1"><LogOut className="h-3 w-3 text-emerald-600" /> Left {app.completedAt}</span>
                                                )}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {app.type === "video" ? (
                                            <span className="flex items-center gap-1.5 text-blue-600 text-xs font-bold uppercase tracking-tighter">
                                                <Video className="h-3.5 w-3.5" /> Tele-health
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-orange-600 text-xs font-bold uppercase tracking-tighter">
                                                <MapPin className="h-3.5 w-3.5" /> In-Clinic
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={badgeVariant(app.status)}>{STATUS_LABEL[app.status]}</Badge>
                                        {app.status === "cancelled" && app.cancellationReason && (
                                            <p className="mt-1 max-w-[14rem] text-xs text-destructive">{reasonText(app.cancellationReason)}</p>
                                        )}
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

            {/* Phones: one card per appointment, so every action stays reachable. */}
            <div className="md:hidden space-y-3">
                {visible.length === 0 ? (
                    <p className="rounded-2xl border bg-card/60 py-12 text-center text-sm text-muted-foreground">
                        {appointments.length === 0
                            ? "No appointments have been booked with you yet."
                            : term
                                ? "No appointments match your search."
                                : `No ${tab === "today" ? "appointments today" : tab === "upcoming" ? "upcoming appointments" : "past appointments"}.`}
                    </p>
                ) : (
                    visible.map((app) => (
                        <div key={app.id} className="rounded-2xl border bg-card/60 p-4 shadow-sm space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold truncate">{app.patient}</p>
                                    <p className="text-xs text-muted-foreground truncate">{app.patientEmail}</p>
                                    {app.patientPhone && <p className="text-xs text-muted-foreground">{app.patientPhone}</p>}
                                </div>
                                <Badge variant={badgeVariant(app.status)}>{STATUS_LABEL[app.status]}</Badge>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="font-medium">{app.date} · {app.time} – {app.endTime}</span>
                                <span className={cn("flex items-center gap-1.5 text-xs font-bold uppercase tracking-tighter", app.type === "video" ? "text-blue-600" : "text-orange-600")}>
                                    {app.type === "video" ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                                    {app.type === "video" ? "Tele-health" : "In-Clinic"}
                                </span>
                            </div>
                            {app.notes && <p className="text-xs italic text-muted-foreground">“{app.notes}”</p>}
                            {app.status === "cancelled" && app.cancellationReason && (
                                <p className="text-xs text-destructive">{reasonText(app.cancellationReason)}</p>
                            )}
                            <div className="flex justify-end border-t pt-3">
                                <RowActions app={app} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function RowActions({ app }: { app: DoctorAppointment }) {
    const [pending, startTransition] = useTransition()
    const [cancelOpen, setCancelOpen] = useState(false)
    const [reason, setReason] = useState("")

    // Visit lifecycle: pending → confirmed → in-progress → completed.
    const canConfirm = app.status === "pending"
    const canStart = app.status === "pending" || app.status === "confirmed"
    const canComplete = app.status === "in-progress"
    const canCancel = app.status === "pending" || app.status === "confirmed"

    if (!canConfirm && !canStart && !canComplete && !canCancel && !app.canMarkMissed) {
        return <span className="text-xs text-muted-foreground">—</span>
    }

    function run(fn: () => Promise<DoctorAppointmentState>, onDone?: () => void) {
        startTransition(async () => {
            const res = await fn()
            if (res?.error) window.alert(res.error)
            else onDone?.()
        })
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <div className="flex justify-end gap-1.5">
                {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />}
                {canConfirm && (
                    <Button variant="outline" size="icon" disabled={pending} title="Confirm"
                        onClick={() => run(() => doctorConfirmAppointment(app.id))}
                        className="h-8 w-8 text-blue-600 border-blue-100 hover:bg-blue-50">
                        <Check className="h-4 w-4" />
                    </Button>
                )}
                {canStart && (
                    <Button variant="outline" size="icon" disabled={pending} title="Start visit (patient arrived)"
                        onClick={() => run(() => doctorStartAppointment(app.id))}
                        className="h-8 w-8 text-indigo-600 border-indigo-100 hover:bg-indigo-50">
                        <PlayCircle className="h-4 w-4" />
                    </Button>
                )}
                {canComplete && (
                    <Button variant="outline" size="icon" disabled={pending} title="Complete visit"
                        onClick={() => run(() => doctorCompleteAppointment(app.id))}
                        className="h-8 w-8 text-emerald-600 border-emerald-100 hover:bg-emerald-50">
                        <CheckCheck className="h-4 w-4" />
                    </Button>
                )}
                {app.canMarkMissed && (
                    <Button variant="outline" size="icon" disabled={pending} title="Mark as missed (patient did not come)"
                        onClick={() => {
                            if (window.confirm(`Mark ${app.patient}'s appointment as missed?`)) run(() => doctorMarkMissed(app.id))
                        }}
                        className="h-8 w-8 text-amber-600 border-amber-100 hover:bg-amber-50">
                        <UserX className="h-4 w-4" />
                    </Button>
                )}
                {canCancel && (
                    <Button variant="outline" size="icon" disabled={pending} title="Cancel"
                        onClick={() => setCancelOpen((open) => !open)}
                        className="h-8 w-8 text-destructive border-red-100 hover:bg-red-50">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {cancelOpen && (
                <div className="w-64 space-y-2 rounded-lg border bg-background p-3 text-left shadow-sm">
                    <label className="text-xs font-medium">Reason shown to the patient (optional)</label>
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        placeholder="e.g. I'm unavailable that day"
                        className="text-xs"
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setCancelOpen(false)}>Keep</Button>
                        <Button type="button" size="sm" variant="destructive" disabled={pending}
                            onClick={() => run(() => doctorCancelAppointment(app.id, reason), () => setCancelOpen(false))}>
                            Cancel appointment
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
