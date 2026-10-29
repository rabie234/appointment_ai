"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
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
    CalendarClock,
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
import {
    createDoctorLeave,
    type LeaveActionState,
} from "./leave-actions"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

export type DoctorRow = {
    id: string
    name: string
    nameAr: string
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
    nameAr: string
    description: string
}

function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            disabled={pending}
            className="gap-2 shadow-lg shadow-blue-200"
        >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </Button>
    )
}

// Doctor add/edit modal
function DoctorDialog({
    doctor,
    specialties,
    onClose,
}: {
    doctor: DoctorRow | null
    specialties: SpecialtyRow[]
    onClose: () => void
}) {
    const { language } = useLanguage()
    const isEdit = Boolean(doctor)
    const action = isEdit ? updateDoctor : createDoctor

    const [state, formAction] = useActionState<DoctorFormState, FormData>(
        action,
        {}
    )

    useEffect(() => {
        if (state.success) onClose()
    }, [state.success, onClose])

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between border-b p-5">
                <h2 className="text-lg font-bold">
                    {t(language, isEdit ? "Edit Doctor" : "Add New Doctor")}
                </h2>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t(language, "Close")}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <form action={formAction} className="space-y-4 p-5">
                {doctor && (
                    <input type="hidden" name="id" value={doctor.id} />
                )}

<Field label={t(language, "Full Name")}>
    <Input
        name="name"
        defaultValue={doctor?.name}
        placeholder="Dr. Jane Doe"
        required
    />
</Field>

<Field label={t(language, "Arabic Name")}>
    <Input
        name="nameAr"
        defaultValue={doctor?.nameAr ?? ""}
        placeholder="د. أحمد محمد"
        dir="rtl"
    />
</Field>


                <Field label={t(language, "Specialty")}>
                    <select
                        name="specialty"
                        defaultValue={doctor?.specialty ?? ""}
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <option value="" disabled>
                            {t(language, "Select a specialty")}
                        </option>

                        {specialties.map((specialty) => (
                            <option key={specialty.id} value={specialty.name}>
                                {language === "ar" && specialty.nameAr
    ? specialty.nameAr
    : specialty.name}
                            </option>
                        ))}

                        {doctor &&
                            !specialties.some(
                                (specialty) =>
                                    specialty.name === doctor.specialty
                            ) && (
                                <option value={doctor.specialty}>
                                   {language === "ar"
    ? specialties.find((s) => s.name === doctor.specialty)?.nameAr || doctor.specialty
    : doctor.specialty}
                                </option>
                            )}
                    </select>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                    <Field label={t(language, "Email")}>
                        <Input
                            name="email"
                            type="email"
                            defaultValue={doctor?.email}
                            placeholder="jane@clinic.com"
                            required
                        />
                    </Field>

                    <Field label={t(language, "Phone")}>
                        <Input
                            name="phone"
                            defaultValue={doctor?.phone}
                            placeholder="+1 555 000 0000"
                        />
                    </Field>
                </div>

                <Field label={t(language, "Experience")}>
                    <Input
                        name="experience"
                        defaultValue={doctor?.experience}
                        placeholder="e.g. 8 Years"
                    />
                </Field>

                <Field label={t(language, "Status")}>
                    <Select
                        name="status"
                        defaultValue={doctor?.status ?? "active"}
                    >
                        <option value="active">{t(language, "Active")}</option>
                        <option value="inactive">
                            {t(language, "Inactive")}
                        </option>
                    </Select>
                </Field>

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

                    <SubmitButton>
                        {t(language, isEdit ? "Save Changes" : "Add Doctor")}
                    </SubmitButton>
                </div>
            </form>
        </Overlay>
    )
}

// Doctor leave modal
function DoctorLeaveDialog({
    doctors,
    onClose,
}: {
    doctors: DoctorRow[]
    onClose: () => void
}) {
    const { language } = useLanguage()

    const [state, formAction] = useActionState<LeaveActionState, FormData>(
        createDoctorLeave,
        {}
    )

    useEffect(() => {
        if (state.success) onClose()
    }, [state.success, onClose])

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between border-b p-5">
                <div>
                    <h2 className="text-lg font-bold">
                        {t(language, "Schedule Doctor Leave")}
                    </h2>

                    <p className="text-sm text-muted-foreground">
                        {t(
                            language,
                            "Mark leave dates and flag affected appointments."
                        )}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t(language, "Close")}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <form action={formAction} className="space-y-4 p-5">
                <Field label={t(language, "Doctor")}>
                    <select
                        name="doctorId"
                        required
                        defaultValue=""
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                        <option value="" disabled>
                            {t(language, "Select a doctor")}
                        </option>

                        {doctors
                            .filter((doctor) => doctor.status === "active")
                            .map((doctor) => (
                                <option key={doctor.id} value={doctor.id}>
                                    {language === "ar" && doctor.nameAr
  ? doctor.nameAr
  : doctor.name} — {doctor.specialty}
                                </option>
                            ))}
                    </select>
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t(language, "Start date")}>
                        <Input name="startDate" type="date" required />
                    </Field>

                    <Field label={t(language, "End date")}>
                        <Input name="endDate" type="date" required />
                    </Field>
                </div>

                <Field label={t(language, "Reason (optional)")}>
                    <Input
                        name="reason"
                        placeholder={t(language, "e.g. Annual leave")}
                        maxLength={300}
                    />
                </Field>

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

                    <SubmitButton>
                        {t(language, "Schedule Leave")}
                    </SubmitButton>
                </div>
            </form>
        </Overlay>
    )
}
// Doctor schedule modal
function ScheduleDialog({
    doctor,
    clinicHours,
    onClose,
}: {
    doctor: DoctorRow
    clinicHours: DayHours[]
    onClose: () => void
}) {
    const { language } = useLanguage()

    const [state, formAction] = useActionState<DoctorFormState, FormData>(
        updateDoctorSchedule,
        {}
    )

    useEffect(() => {
        if (state.success) onClose()
    }, [state.success, onClose])

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between border-b p-5">
                <div>
                    <h2 className="text-lg font-bold">
                        {t(language, "Availability")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {doctor.name}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t(language, "Close")}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <form action={formAction} className="space-y-4 p-5">
                <input type="hidden" name="id" value={doctor.id} />

                <div className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <p>
                        {t(
                            language,
                            "Hours must fall within the clinic's opening times. Doctors can only work on days the clinic is open."
                        )}
                    </p>
                    <p className="font-medium text-foreground/70">
                        {t(language, "Clinic")}:{" "}
                        {clinicHoursSummary(clinicHours, language)}
                    </p>
                </div>

                <WeekEditor
                    prefix="doctor"
                    initial={doctor.schedule}
                    closedLabel={t(language, "Off")}
                />

                {state.error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                        {state.error}
                    </p>
                )}

                <div className="flex justify-end gap-3 pt-1">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                    >
                        {t(language, "Cancel")}
                    </Button>
                    <SubmitButton>
                        {t(language, "Save Schedule")}
                    </SubmitButton>
                </div>
            </form>
        </Overlay>
    )
}

// Specialties modal
function SpecialtiesDialog({
    specialties,
    onClose,
}: {
    specialties: SpecialtyRow[]
    onClose: () => void
}) {
    const { language } = useLanguage()

    const [state, formAction] = useActionState<SpecialtyFormState, FormData>(
        createSpecialty,
        {}
    )
    const formRef = useRef<HTMLFormElement>(null)

    useEffect(() => {
        if (state.success) formRef.current?.reset()
    }, [state.success])

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between border-b p-5">
                <h2 className="text-lg font-bold">
                    {t(language, "Manage Specialties")}
                </h2>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t(language, "Close")}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="space-y-5 p-5">
                <form
                    ref={formRef}
                    action={formAction}
                    className="space-y-3"
                >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <Input
        name="name"
        placeholder={t(language, "Specialty name")}
        required
    />

    <Input
        name="nameAr"
        placeholder="اسم التخصص بالعربية"
        dir="rtl"
    />

    <Input
        name="description"
        placeholder={t(
            language,
            "Short description (optional)"
        )}
    />

    <SubmitButton>
        <Plus className="h-4 w-4" />
        {t(language, "Add")}
    </SubmitButton>
</div>

                    {state.error && (
                        <p className="text-sm font-medium text-destructive">
                            {state.error}
                        </p>
                    )}
                </form>

                <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                    {specialties.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">
                            {t(language, "No specialties yet.")}
                        </p>
                    ) : (
                        specialties.map((specialty) => (
                            <div
                                key={specialty.id}
                                className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <p
    className="truncate font-semibold"
    dir={language === "ar" ? "rtl" : "ltr"}
>
    {language === "ar" && specialty.nameAr
        ? specialty.nameAr
        : specialty.name}
</p>
                                    {specialty.description && (
                                        <p className="truncate text-xs text-muted-foreground">
                                            {specialty.description}
                                        </p>
                                    )}
                                </div>

                                <DeleteButton
                                    onDelete={() =>
                                        deleteSpecialty(specialty.id)
                                    }
                                    confirmMessage={`${t(
                                        language,
                                        "Delete specialty"
                                    )} "${specialty.name}"?`}
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Overlay>
    )
}

// Delete button
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

        try {
            const result = await onDelete()
            if (result?.error) window.alert(result.error)
        } finally {
            setPending(false)
        }
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handle}
            disabled={pending}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label="Delete"
        >
            {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Trash2 className="h-4 w-4" />
            )}
        </Button>
    )
}

// Main manager
export function DoctorsManager({
    doctors,
    specialties,
    clinicHours,
}: {
    doctors: DoctorRow[]
    specialties: SpecialtyRow[]
    clinicHours: DayHours[]
}) {
    const { language } = useLanguage()

    const [searchTerm, setSearchTerm] = useState("")
    const [dialog, setDialog] = useState<
        null | { mode: "create" } | { mode: "edit"; doctor: DoctorRow }
    >(null)
    const [scheduleFor, setScheduleFor] = useState<DoctorRow | null>(null)
    const [specialtiesOpen, setSpecialtiesOpen] = useState(false)
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)

    const term = searchTerm.trim().toLowerCase()

    const filtered = term
        ? doctors.filter(
              (doctor) =>
                  doctor.name.toLowerCase().includes(term) ||
                  doctor.specialty.toLowerCase().includes(term)
          )
        : doctors

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t(language, "Doctor Management")}
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        {t(
                            language,
                            "Add, edit, and manage clinic staff records."
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => setLeaveDialogOpen(true)}
                    >
                        <CalendarClock className="h-4 w-4" />
                        {t(language, "Schedule Leave")}
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => setSpecialtiesOpen(true)}
                    >
                        <Stethoscope className="h-4 w-4" />
                        {t(language, "Specialties")}
                    </Button>

                    <Button
                        type="button"
                        className="gap-2 shadow-lg shadow-blue-200"
                        onClick={() => setDialog({ mode: "create" })}
                    >
                        <Plus className="h-4 w-4" />
                        {t(language, "Add New Doctor")}
                    </Button>
                </div>
            </div>

            <div className="flex flex-col items-center gap-4 md:flex-row">
                <div className="relative w-full flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder={t(
                            language,
                            "Search by name or specialty..."
                        )}
                        className="h-11 border-none bg-card pl-10 shadow-sm"
                        value={searchTerm}
                        onChange={(event) =>
                            setSearchTerm(event.target.value)
                        }
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border bg-card/60 shadow-sm backdrop-blur-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="border-muted/50 bg-muted/30 hover:bg-transparent">
                            <TableHead className="w-12 pl-6">#</TableHead>
                            <TableHead>{t(language, "Doctor")}</TableHead>
                            <TableHead>{t(language, "Specialty")}</TableHead>
                            <TableHead>{t(language, "Joined Date")}</TableHead>
                            <TableHead>{t(language, "Status")}</TableHead>
                            <TableHead>{t(language, "Availability")}</TableHead>
                            <TableHead className="pr-6 text-right">
                                {t(language, "Actions")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="py-12 text-center text-muted-foreground"
                                >
                                    {doctors.length === 0
                                        ? t(
                                              language,
                                              'No doctors yet. Click "Add New Doctor" to get started.'
                                          )
                                        : t(
                                              language,
                                              "No doctors match your search."
                                          )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((doctor, index) => (
                                <TableRow
                                    key={doctor.id}
                                    className="group border-muted/30 transition-colors hover:bg-accent/40"
                                >
                                    <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                                        {index + 1}
                                    </TableCell>

                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                                                <User className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <span className="block font-bold">
                                            <span
    className="block font-bold"
    dir={language === "ar" ? "rtl" : "ltr"}
>
    {language === "ar" && doctor.nameAr
        ? doctor.nameAr
        : doctor.name}
</span>
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {doctor.email}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="font-medium text-primary">
                                       <TableCell className="font-medium text-primary">
    {language === "ar"
        ? specialties.find(
              (s) => s.name === doctor.specialty
          )?.nameAr || doctor.specialty
        : doctor.specialty}
</TableCell>
                                    </TableCell>

                                    <TableCell className="text-sm text-muted-foreground">
                                        {doctor.joined}
                                    </TableCell>

                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                                            {doctor.status === "active" ? (
                                                <>
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span className="text-emerald-600">
                                                        {t(language, "Active")}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                                                    <span className="font-bold text-destructive">
                                                        {t(language, "Inactive")}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <div className="space-y-1">
                                            <Badge
                                                variant={
                                                    doctor.availability ===
                                                    "available"
                                                        ? "success"
                                                        : "secondary"
                                                }
                                            >
                                                {t(
                                                    language,
                                                    doctor.availability ===
                                                        "available"
                                                        ? "Available"
                                                        : "On Leave"
                                                )}
                                            </Badge>
                                            <p className="text-xs text-muted-foreground">
                                                {workingDaysLabel(
                                                    doctor.schedule,
                                                    language
                                                )}
                                            </p>
                                        </div>
                                    </TableCell>

                                    <TableCell className="pr-6 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() =>
                                                    setScheduleFor(doctor)
                                                }
                                                title={t(
                                                    language,
                                                    "Edit schedule"
                                                )}
                                                aria-label={t(
                                                    language,
                                                    "Edit schedule"
                                                )}
                                            >
                                                <CalendarClock className="h-4 w-4" />
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() =>
                                                    setDialog({
                                                        mode: "edit",
                                                        doctor,
                                                    })
                                                }
                                                title={t(
                                                    language,
                                                    "Edit details"
                                                )}
                                                aria-label={t(
                                                    language,
                                                    "Edit details"
                                                )}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>

                                            <DeleteButton
                                                onDelete={() =>
                                                    deleteDoctor(doctor.id)
                                                }
                                                confirmMessage={`${t(
                                                    language,
                                                    "Delete"
                                                )} ${doctor.name}? ${t(
                                                    language,
                                                    "This cannot be undone."
                                                )}`}
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
                    doctor={
                        dialog.mode === "edit" ? dialog.doctor : null
                    }
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
                <SpecialtiesDialog
                    specialties={specialties}
                    onClose={() => setSpecialtiesOpen(false)}
                />
            )}

            {leaveDialogOpen && (
                <DoctorLeaveDialog
                    doctors={doctors}
                    onClose={() => setLeaveDialogOpen(false)}
                />
            )}
        </div>
    )
}
/** Short summary of the days a doctor works, e.g. "Mon, Tue, Wed +2". */
function workingDaysLabel(
    schedule: DayHours[],
    language: ReturnType<typeof useLanguage>["language"]
): string {
    const open = DAYS.filter((day) => {
        const entry = schedule.find((item) => item.day === day)
        return entry && !entry.closed
    })

    if (open.length === 0) return t(language, "No working days")
    if (open.length === 7) return t(language, "Every day")

    const short = open.map((day) => t(language, day).slice(0, 3))

    return short.length > 3
        ? `${short.slice(0, 3).join(", ")} +${short.length - 3}`
        : short.join(", ")
}

/** Summary of the clinic's opening hours. */
function clinicHoursSummary(
    hours: DayHours[],
    language: ReturnType<typeof useLanguage>["language"]
): string {
    const parts = DAYS.map((day) => {
        const hoursForDay = hours.find((item) => item.day === day)

        if (!hoursForDay || hoursForDay.closed) {
            return `${t(language, day).slice(0, 3)} ${t(language, "closed")}`
        }

        return `${t(language, day).slice(0, 3)} ${hoursForDay.open}–${hoursForDay.close}`
    })

    return parts.join(" · ")
}

// Modal overlay
function Overlay({
    children,
    onClose,
}: {
    children: React.ReactNode
    onClose: () => void
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl rounded-2xl border bg-card shadow-xl animate-in zoom-in-95 duration-200"
                onClick={(event) => event.stopPropagation()}
            >
                {children}
            </div>
        </div>
    )
}

// Form field wrapper
function Field({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-medium">{label}</span>
            {children}
        </label>
    )
}

// Select input wrapper
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