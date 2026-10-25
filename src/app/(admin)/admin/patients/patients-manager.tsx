"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    Search,
    Edit,
    Trash2,
    X,
    Eye,
    Loader2,
    Users,
    UserPlus,
    CalendarClock,
    CheckCheck,
    Mail,
    Phone,
    CalendarDays,
    Video,
    MapPin,
} from "lucide-react"
import {
    createPatient,
    updatePatient,
    deletePatient,
    type PatientFormState,
} from "./actions"

export type PatientVisit = {
    id: string
    doctor: string
    specialty: string
    date: string
    /** Scheduled window, already formatted (e.g. "9:00 AM – 9:30 AM"). */
    time: string
    type: "video" | "in-person"
    status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled" | "missed"
}

export type PatientRow = {
    id: string
    name: string
    email: string
    phone: string
    joined: string
    /** Registered within the last 30 days. */
    isNew: boolean
    totalVisits: number
    completedVisits: number
    /** Pending, confirmed or in-progress — blocks deletion. */
    activeVisits: number
    totalSpent: number
    lastVisit?: string
    nextVisit?: string
    /** Full appointment history, newest first. */
    visits: PatientVisit[]
}

const FILTERS = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming visit" },
    { key: "new", label: "New (30 days)" },
    { key: "no-visits", label: "No visits" },
] as const

type FilterKey = (typeof FILTERS)[number]["key"]

function matchesFilter(p: PatientRow, filter: FilterKey): boolean {
    switch (filter) {
        case "all":
            return true
        case "upcoming":
            return Boolean(p.nextVisit)
        case "new":
            return p.isNew
        case "no-visits":
            return p.totalVisits === 0
    }
}

const STATUS_LABEL: Record<PatientVisit["status"], string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    "in-progress": "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    missed: "Missed",
}

function badgeVariant(status: PatientVisit["status"]) {
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

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join("")
}

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="gap-2 shadow-lg shadow-blue-200">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </Button>
    )
}

// ── Patient add/edit modal ────────────────────────────────────────────────

function PatientDialog({
    patient,
    onClose,
}: {
    patient: PatientRow | null
    onClose: () => void
}) {
    const isEdit = Boolean(patient)
    const action = isEdit ? updatePatient : createPatient
    const [state, formAction] = useActionState<PatientFormState, FormData>(action, {})

    useEffect(() => {
        if (state.success) onClose()
    }, [state.success, onClose])

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between border-b p-5">
                <h2 className="text-lg font-bold">{isEdit ? "Edit Patient" : "Add New Patient"}</h2>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                </button>
            </div>

            <form action={formAction} className="space-y-4 p-5">
                {patient && <input type="hidden" name="id" value={patient.id} />}

                <Field label="Full Name">
                    <Input name="name" defaultValue={patient?.name} placeholder="Jane Doe" required />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Email">
                        <Input name="email" type="email" defaultValue={patient?.email} placeholder="jane@example.com" required />
                    </Field>
                    <Field label="Phone">
                        <Input name="phone" defaultValue={patient?.phone} placeholder="+1 555 000 0000" />
                    </Field>
                </div>

                <Field label={isEdit ? "New Password" : "Password"}>
                    <Input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        required={!isEdit}
                        placeholder={isEdit ? "Leave blank to keep the current password" : "At least 6 characters"}
                    />
                </Field>

                {!isEdit && (
                    <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        The patient can sign in with this email and password and change their details afterwards.
                    </p>
                )}

                {state.error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                        {state.error}
                    </p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <SubmitButton>{isEdit ? "Save Changes" : "Add Patient"}</SubmitButton>
                </div>
            </form>
        </Overlay>
    )
}

// ── Patient details modal ─────────────────────────────────────────────────

function DetailsDialog({
    patient,
    onEdit,
    onClose,
}: {
    patient: PatientRow
    onEdit: () => void
    onClose: () => void
}) {
    return (
        <Overlay onClose={onClose} wide>
            <div className="flex items-start justify-between border-b p-5">
                <div className="flex items-center gap-4">
                    <Avatar name={patient.name} large />
                    <div>
                        <h2 className="text-lg font-bold">{patient.name}</h2>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{patient.email}</span>
                            {patient.phone && (
                                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{patient.phone}</span>
                            )}
                            <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Joined {patient.joined}</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniStat label="Total visits" value={String(patient.totalVisits)} />
                    <MiniStat label="Completed" value={String(patient.completedVisits)} />
                    <MiniStat label="Active" value={String(patient.activeVisits)} />
                    <MiniStat label="Total billed" value={currency.format(patient.totalSpent)} />
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Appointment History</h3>
                    <div className="max-h-80 overflow-y-auto rounded-lg border divide-y">
                        {patient.visits.length === 0 ? (
                            <p className="p-6 text-center text-sm text-muted-foreground">
                                This patient has not booked any appointments yet.
                            </p>
                        ) : (
                            patient.visits.map((v) => (
                                <div key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate">{v.doctor}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {v.specialty && <>{v.specialty} · </>}
                                            {v.date} · {v.time}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {v.type === "video" ? (
                                            <Video className="h-4 w-4 text-blue-600" aria-label="Tele-health" />
                                        ) : (
                                            <MapPin className="h-4 w-4 text-orange-600" aria-label="In-clinic" />
                                        )}
                                        <Badge variant={badgeVariant(v.status)}>{STATUS_LABEL[v.status]}</Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    <Button className="gap-2" onClick={onEdit}>
                        <Edit className="h-4 w-4" /> Edit Patient
                    </Button>
                </div>
            </div>
        </Overlay>
    )
}

// ── Delete button ──────────────────────────────────────────────────────────

function DeleteButton({ patient }: { patient: PatientRow }) {
    const [pending, setPending] = useState(false)

    async function handle() {
        if (patient.activeVisits > 0) {
            window.alert(
                `${patient.name} has ${patient.activeVisits} active appointment(s). Cancel or complete them before deleting.`
            )
            return
        }
        const confirmMessage =
            `Delete ${patient.name}? Their account, appointment history and AI conversations ` +
            "will be permanently removed. This cannot be undone."
        if (!window.confirm(confirmMessage)) return
        setPending(true)
        const res = await deletePatient(patient.id)
        setPending(false)
        if (res?.error) window.alert(res.error)
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handle}
            disabled={pending}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Delete patient"
        >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
    )
}

// ── Main manager ───────────────────────────────────────────────────────────

export function PatientsManager({ patients }: { patients: PatientRow[] }) {
    const [searchTerm, setSearchTerm] = useState("")
    const [filter, setFilter] = useState<FilterKey>("all")
    const [dialog, setDialog] = useState<null | { mode: "create" } | { mode: "edit"; patient: PatientRow }>(null)
    const [detailsId, setDetailsId] = useState<string | null>(null)

    // Look the patient up by id so the details view reflects fresh server data
    // after an edit/revalidate, and closes itself if the patient is deleted.
    const details = detailsId ? patients.find((p) => p.id === detailsId) ?? null : null

    const term = searchTerm.trim().toLowerCase()
    const filtered = patients.filter(
        (p) =>
            matchesFilter(p, filter) &&
            (!term ||
                p.name.toLowerCase().includes(term) ||
                p.email.toLowerCase().includes(term) ||
                p.phone.toLowerCase().includes(term))
    )

    const stats = [
        {
            title: "Total Patients",
            value: patients.length,
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-100 dark:bg-blue-900/20",
        },
        {
            title: "New (30 days)",
            value: patients.filter((p) => p.isNew).length,
            icon: UserPlus,
            color: "text-orange-600",
            bg: "bg-orange-100 dark:bg-orange-900/20",
        },
        {
            title: "With Upcoming Visit",
            value: patients.filter((p) => p.nextVisit).length,
            icon: CalendarClock,
            color: "text-purple-600",
            bg: "bg-purple-100 dark:bg-purple-900/20",
        },
        {
            title: "Completed Visits",
            value: patients.reduce((sum, p) => sum + p.completedVisits, 0),
            icon: CheckCheck,
            color: "text-emerald-600",
            bg: "bg-emerald-100 dark:bg-emerald-900/20",
        },
    ]

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Patient Management</h1>
                    <p className="text-muted-foreground mt-1">View patient records, visit history, and manage accounts.</p>
                </div>
                <Button className="shadow-lg shadow-blue-200 gap-2" onClick={() => setDialog({ mode: "create" })}>
                    <Plus className="h-4 w-4" />
                    Add New Patient
                </Button>
            </div>

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <div key={stat.title} className="rounded-2xl border bg-card/60 backdrop-blur-sm p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                                <div className={cn("p-2 rounded-lg", stat.bg)}>
                                    <Icon className={cn("h-4 w-4", stat.color)} />
                                </div>
                            </div>
                            <p className="mt-3 text-2xl font-bold">{stat.value.toLocaleString()}</p>
                        </div>
                    )
                })}
            </div>

            <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email or phone..."
                        className="pl-10 h-11 bg-card border-none shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                                filter === f.key
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-card border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {f.label}
                            <span className="ml-2 opacity-70">
                                {patients.filter((p) => matchesFilter(p, f.key)).length}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-muted/50 bg-muted/30">
                            <TableHead className="pl-6 w-12">#</TableHead>
                            <TableHead>Patient</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead>Visits</TableHead>
                            <TableHead>Last Visit</TableHead>
                            <TableHead>Next Appointment</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                    {patients.length === 0
                                        ? "No patients yet. Patients appear here once they register or you add one."
                                        : "No patients match your search."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((patient, idx) => (
                                <TableRow key={patient.id} className="group hover:bg-accent/40 transition-colors border-muted/30">
                                    <TableCell className="pl-6 text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                                    <TableCell>
                                        <button
                                            className="flex items-center gap-3 text-left"
                                            onClick={() => setDetailsId(patient.id)}
                                        >
                                            <Avatar name={patient.name} />
                                            <div>
                                                <span className="font-bold flex items-center gap-2">
                                                    {patient.name}
                                                    {patient.isNew && <Badge variant="success">New</Badge>}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{patient.email}</span>
                                            </div>
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {patient.phone || <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{patient.joined}</TableCell>
                                    <TableCell>
                                        <div className="leading-tight">
                                            <span className="font-semibold">{patient.totalVisits}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {patient.completedVisits} completed
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {patient.lastVisit ?? <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {patient.nextVisit ? (
                                            <span className="font-medium text-primary">{patient.nextVisit}</span>
                                        ) : (
                                            <span className="text-muted-foreground">None scheduled</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => setDetailsId(patient.id)}
                                                title="View details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => setDialog({ mode: "edit", patient })}
                                                title="Edit details"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <DeleteButton patient={patient} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {details && !dialog && (
                <DetailsDialog
                    patient={details}
                    onEdit={() => setDialog({ mode: "edit", patient: details })}
                    onClose={() => setDetailsId(null)}
                />
            )}
            {dialog && (
                <PatientDialog
                    patient={dialog.mode === "edit" ? dialog.patient : null}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    )
}

// ── Small primitives ──────────────────────────────────────────────────────

function Avatar({ name, large }: { name: string; large?: boolean }) {
    return (
        <div
            className={cn(
                "rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 font-bold text-primary shrink-0",
                large ? "h-14 w-14 text-lg" : "h-9 w-9 text-xs"
            )}
        >
            {initials(name) || "?"}
        </div>
    )
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
        </div>
    )
}

function Overlay({
    children,
    onClose,
    wide,
}: {
    children: React.ReactNode
    onClose: () => void
    wide?: boolean
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className={cn(
                    "w-full rounded-2xl border bg-card shadow-xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto",
                    wide ? "max-w-2xl" : "max-w-xl"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-medium">{label}</span>
            {children}
        </label>
    )
}
