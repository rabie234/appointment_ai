"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
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
    User,
    X,
    CheckCircle2,
    XCircle,
    Stethoscope,
    Loader2,
    CalendarClock
} from "lucide-react"
import { WeekEditor } from "@/components/schedule/week-editor"
import { DAYS, type DayHours } from "@/lib/schedule"
import {
    createDoctor,
    updateDoctor,
    deleteDoctor,
    updateDoctorSchedule,
    createSpecialty,
    deleteSpecialty,
    type DoctorFormState,
    type SpecialtyFormState,
} from "./actions"

export type DoctorRow = {
    id: string
    name: string
    specialty: string
    email: string
    phone: string
    experience: string
    status: "active" | "inactive"
    availability: "available" | "on-leave"
    joined: string
    schedule: DayHours[]
}

export type SpecialtyRow = {
    id: string
    name: string
    description: string
}

function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus()
    return (
        <Button type="submit" disabled={pending} className="gap-2 shadow-lg shadow-blue-200">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </Button>
    )
}

// ── Doctor add/edit modal ─────────────────────────────────────────────────

function DoctorDialog({
    doctor,
    specialties,
    onClose,
}: {
    doctor: DoctorRow | null
    specialties: SpecialtyRow[]
    onClose: () => void
}) {
    const isEdit = Boolean(doctor)
    const action = isEdit ? updateDoctor : createDoctor
    const [state, formAction] = useActionState<DoctorFormState, FormData>(action, {})

    useEffect(() => {
        if (state.success) onClose()
    }, [state.success, onClose])

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between border-b p-5">
                <h2 className="text-lg font-bold">{isEdit ? "Edit Doctor" : "Add New Doctor"}</h2>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                </button>
            </div>

            <form action={formAction} className="space-y-4 p-5">
                {doctor && <input type="hidden" name="id" value={doctor.id} />}

                <Field label="Full Name">
                    <Input name="name" defaultValue={doctor?.name} placeholder="Dr. Jane Doe" required />
                </Field>

                <Field label="Specialty">
                    <select
                        name="specialty"
                        defaultValue={doctor?.specialty ?? ""}
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <option value="" disabled>Select a specialty</option>
                        {specialties.map((s) => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                        {/* Preserve a doctor's current specialty even if it was later removed. */}
                        {doctor && !specialties.some((s) => s.name === doctor.specialty) && (
                            <option value={doctor.specialty}>{doctor.specialty}</option>
                        )}
                    </select>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Email">
                        <Input name="email" type="email" defaultValue={doctor?.email} placeholder="jane@clinic.com" required />
                    </Field>
                    <Field label="Phone">
                        <Input name="phone" defaultValue={doctor?.phone} placeholder="+1 555 000 0000" />
                    </Field>
                </div>

                <Field label="Experience">
                    <Input name="experience" defaultValue={doctor?.experience} placeholder="e.g. 8 Years" />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Status">
                        <Select name="status" defaultValue={doctor?.status ?? "active"}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </Select>
                    </Field>
                    <Field label="Availability">
                        <Select name="availability" defaultValue={doctor?.availability ?? "available"}>
                            <option value="available">Available</option>
                            <option value="on-leave">On Leave</option>
                        </Select>
                    </Field>
                </div>

                {state.error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                        {state.error}
                    </p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <SubmitButton>{isEdit ? "Save Changes" : "Add Doctor"}</SubmitButton>
                </div>
            </form>
        </Overlay>
    )
}

// ── Doctor schedule modal ─────────────────────────────────────────────────

function ScheduleDialog({
    doctor,
    clinicHours,
    onClose,
}: {
    doctor: DoctorRow
    clinicHours: DayHours[]
    onClose: () => void
}) {
    const [state, formAction] = useActionState<DoctorFormState, FormData>(updateDoctorSchedule, {})

    useEffect(() => {
        if (state.success) onClose()
    }, [state.success, onClose])

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between border-b p-5">
                <div>
                    <h2 className="text-lg font-bold">Availability</h2>
                    <p className="text-sm text-muted-foreground">{doctor.name}</p>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                </button>
            </div>

            <form action={formAction} className="space-y-4 p-5">
                <input type="hidden" name="id" value={doctor.id} />

                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
                    <p>Hours must fall within the clinic&apos;s opening times. Doctors can only work on days the clinic is open.</p>
                    <p className="font-medium text-foreground/70">Clinic: {clinicHoursSummary(clinicHours)}</p>
                </div>

                <WeekEditor prefix="doctor" initial={doctor.schedule} closedLabel="Off" />

                {state.error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                        {state.error}
                    </p>
                )}

                <div className="flex justify-end gap-3 pt-1">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <SubmitButton>Save Schedule</SubmitButton>
                </div>
            </form>
        </Overlay>
    )
}

// ── Specialties modal ─────────────────────────────────────────────────────

function SpecialtiesDialog({
    specialties,
    onClose,
}: {
    specialties: SpecialtyRow[]
    onClose: () => void
}) {
    const [state, formAction] = useActionState<SpecialtyFormState, FormData>(createSpecialty, {})
    const formRef = useRef<HTMLFormElement>(null)

    useEffect(() => {
        if (state.success) formRef.current?.reset()
    }, [state.success])

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between border-b p-5">
                <h2 className="text-lg font-bold">Manage Specialties</h2>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="p-5 space-y-5">
                <form ref={formRef} action={formAction} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-3">
                        <Input name="name" placeholder="Specialty name" required />
                        <Input name="description" placeholder="Short description (optional)" />
                        <SubmitButton>
                            <Plus className="h-4 w-4" /> Add
                        </SubmitButton>
                    </div>
                    {state.error && (
                        <p className="text-sm font-medium text-destructive">{state.error}</p>
                    )}
                </form>

                <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
                    {specialties.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">No specialties yet.</p>
                    ) : (
                        specialties.map((s) => (
                            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                    <p className="font-semibold truncate">{s.name}</p>
                                    {s.description && (
                                        <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                                    )}
                                </div>
                                <DeleteButton
                                    onDelete={() => deleteSpecialty(s.id)}
                                    confirmMessage={`Delete specialty "${s.name}"?`}
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Overlay>
    )
}

// ── Delete button (used by rows + specialties) ─────────────────────────────

function DeleteButton({
    onDelete,
    confirmMessage,
}: {
    onDelete: () => Promise<{ error?: string }>
    confirmMessage: string
}) {
    const [pending, setPending] = useState(false)

    async function handle() {
        if (!window.confirm(confirmMessage)) return
        setPending(true)
        const res = await onDelete()
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
        >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
    )
}

// ── Main manager ───────────────────────────────────────────────────────────

export function DoctorsManager({
    doctors,
    specialties,
    clinicHours,
}: {
    doctors: DoctorRow[]
    specialties: SpecialtyRow[]
    clinicHours: DayHours[]
}) {
    const [searchTerm, setSearchTerm] = useState("")
    const [dialog, setDialog] = useState<null | { mode: "create" } | { mode: "edit"; doctor: DoctorRow }>(null)
    const [scheduleFor, setScheduleFor] = useState<DoctorRow | null>(null)
    const [specialtiesOpen, setSpecialtiesOpen] = useState(false)

    const term = searchTerm.trim().toLowerCase()
    const filtered = term
        ? doctors.filter(
              (d) =>
                  d.name.toLowerCase().includes(term) ||
                  d.specialty.toLowerCase().includes(term)
          )
        : doctors

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Doctor Management</h1>
                    <p className="text-muted-foreground mt-1">Add, edit, and manage clinic staff records.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => setSpecialtiesOpen(true)}>
                        <Stethoscope className="h-4 w-4" />
                        Specialties
                    </Button>
                    <Button className="shadow-lg shadow-blue-200 gap-2" onClick={() => setDialog({ mode: "create" })}>
                        <Plus className="h-4 w-4" />
                        Add New Doctor
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or specialty..."
                        className="pl-10 h-11 bg-card border-none shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-muted/50 bg-muted/30">
                            <TableHead className="pl-6 w-12">#</TableHead>
                            <TableHead>Doctor</TableHead>
                            <TableHead>Specialty</TableHead>
                            <TableHead>Joined Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Availability</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    {doctors.length === 0
                                        ? "No doctors yet. Click \"Add New Doctor\" to get started."
                                        : "No doctors match your search."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((doctor, idx) => (
                                <TableRow key={doctor.id} className="group hover:bg-accent/40 transition-colors border-muted/30">
                                    <TableCell className="pl-6 text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                                                <User className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <span className="font-bold block">{doctor.name}</span>
                                                <span className="text-xs text-muted-foreground">{doctor.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-primary">{doctor.specialty}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{doctor.joined}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 font-semibold text-xs">
                                            {doctor.status === "active" ? (
                                                <>
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="text-emerald-600">Active</span>
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                                                    <span className="text-destructive font-bold">Inactive</span>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <Badge variant={doctor.availability === "available" ? "success" : "secondary"}>
                                                {doctor.availability === "available" ? "Available" : "On Leave"}
                                            </Badge>
                                            <p className="text-xs text-muted-foreground">{workingDaysLabel(doctor.schedule)}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => setScheduleFor(doctor)}
                                                title="Edit schedule"
                                            >
                                                <CalendarClock className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => setDialog({ mode: "edit", doctor })}
                                                title="Edit details"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <DeleteButton
                                                onDelete={() => deleteDoctor(doctor.id)}
                                                confirmMessage={`Delete ${doctor.name}? This cannot be undone.`}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {dialog && (
                <DoctorDialog
                    doctor={dialog.mode === "edit" ? dialog.doctor : null}
                    specialties={specialties}
                    onClose={() => setDialog(null)}
                />
            )}
            {scheduleFor && (
                <ScheduleDialog
                    doctor={scheduleFor}
                    clinicHours={clinicHours}
                    onClose={() => setScheduleFor(null)}
                />
            )}
            {specialtiesOpen && (
                <SpecialtiesDialog specialties={specialties} onClose={() => setSpecialtiesOpen(false)} />
            )}
        </div>
    )
}

/** Short summary of the days a doctor works, e.g. "Mon, Tue, Wed +2". */
function workingDaysLabel(schedule: DayHours[]): string {
    const open = DAYS.filter((day) => {
        const entry = schedule.find((s) => s.day === day)
        return entry && !entry.closed
    })
    if (open.length === 0) return "No working days"
    if (open.length === 7) return "Every day"
    const short = open.map((d) => d.slice(0, 3))
    return short.length > 3 ? `${short.slice(0, 3).join(", ")} +${short.length - 3}` : short.join(", ")
}

/** Compact clinic-window summary, collapsing consecutive identical days. */
function clinicHoursSummary(hours: DayHours[]): string {
    const parts = DAYS.map((day) => {
        const h = hours.find((c) => c.day === day)
        if (!h || h.closed) return `${day.slice(0, 3)} closed`
        return `${day.slice(0, 3)} ${h.open}–${h.close}`
    })
    return parts.join(" · ")
}

// ── Small primitives ──────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl rounded-2xl border bg-card shadow-xl animate-in zoom-in-95 duration-200"
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

function Select({
    name,
    defaultValue,
    children,
}: {
    name: string
    defaultValue?: string
    children: React.ReactNode
}) {
    return (
        <select
            name={name}
            defaultValue={defaultValue}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            {children}
        </select>
    )
}
