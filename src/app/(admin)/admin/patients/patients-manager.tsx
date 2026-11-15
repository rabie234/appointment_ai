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
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"

export type PatientVisit = {
    id: string
    doctor: string
    specialty: string
    date: string
    time: string
    type: "video" | "in-person"
    status:
        | "pending"
        | "confirmed"
        | "in-progress"
        | "completed"
        | "cancelled"
        | "missed"
}

export type PatientRow = {
    id: string
    name: string
    email: string
    phone: string
    joined: string
    isNew: boolean
    totalVisits: number
    completedVisits: number
    activeVisits: number
    totalSpent: number
    lastVisit?: string
    nextVisit?: string
    visits: PatientVisit[]
}

type Language = "en" | "ar"

function usePageLanguage() {
    const { language } = useLanguage()

    return {
        language,
        isArabic: language === "ar",
    }
}

function matchesFilter(
    patient: PatientRow,
    filter: "all" | "upcoming" | "new" | "no-visits"
): boolean {
    switch (filter) {
        case "all":
            return true
        case "upcoming":
            return Boolean(patient.nextVisit)
        case "new":
            return patient.isNew
        case "no-visits":
            return patient.totalVisits === 0
    }
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

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
})

function statusLabel(
    status: PatientVisit["status"],
    language: Language
) {
    const labels: Record<PatientVisit["status"], string> = {
        pending: t(language, "Pending"),
        confirmed: t(language, "Confirmed"),
        "in-progress": t(language, "In progress"),
        completed: t(language, "Completed"),
        cancelled: t(language, "Cancelled"),
        missed: t(language, "Missed"),
    }

    return labels[status]
}

function SubmitButton({
    children,
}: {
    children: React.ReactNode
}) {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            disabled={pending}
            className="gap-2"
        >
            {pending && (
                <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {children}
        </Button>
    )
}

function PatientDialog({
    patient,
    onClose,
}: {
    patient: PatientRow | null
    onClose: () => void
}) {
    const { language, isArabic } = usePageLanguage()
    const isEdit = Boolean(patient)
    const action = isEdit ? updatePatient : createPatient

    const [state, formAction] = useActionState<
        PatientFormState,
        FormData
    >(action, {})

    useEffect(() => {
        if (state.success) onClose()
    }, [state.success, onClose])

    return (
        <Overlay onClose={onClose} isArabic={isArabic}>
            <div className="flex items-center justify-between gap-4 border-b p-4 sm:p-5">
                <h2 className="text-lg font-bold">
                    {t(
                        language,
                        isEdit ? "Edit Patient" : "Add New Patient"
                    )}
                </h2>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t(language, "Close")}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <form
                action={formAction}
                className="space-y-4 p-4 sm:p-5"
            >
                {patient && (
                    <input
                        type="hidden"
                        name="id"
                        value={patient.id}
                    />
                )}

                <Field label={t(language, "Full Name")}>
                    <Input
                        name="name"
                        defaultValue={patient?.name}
                        placeholder={
                            isArabic ? "اسم المريض" : "Jane Doe"
                        }
                        required
                    />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t(language, "Email")}>
                        <Input
                            name="email"
                            type="email"
                            defaultValue={patient?.email}
                            placeholder="name@example.com"
                            required
                            dir="ltr"
                        />
                    </Field>

                    <Field label={t(language, "Phone")}>
                        <Input
                            name="phone"
                            defaultValue={patient?.phone}
                            placeholder="+961..."
                            dir="ltr"
                        />
                    </Field>
                </div>

                <Field
                    label={t(
                        language,
                        isEdit ? "New Password" : "Password"
                    )}
                >
                    <Input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        required={!isEdit}
                        placeholder={
                            isEdit
                                ? t(
                                      language,
                                      "Leave blank to keep the current password"
                                  )
                                : t(language, "At least 6 characters")
                        }
                    />
                </Field>

                {!isEdit && (
                    <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        {t(
                            language,
                            "The patient can sign in with this email and password and change their details afterwards."
                        )}
                    </p>
                )}

                {state.error && (
                    <p
                        role="alert"
                        className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
                    >
                        {state.error}
                    </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                    >
                        {t(language, "Cancel")}
                    </Button>

                    <SubmitButton>
                        {t(
                            language,
                            isEdit ? "Save Changes" : "Add Patient"
                        )}
                    </SubmitButton>
                </div>
            </form>
        </Overlay>
    )
}

function DetailsDialog({
    patient,
    onEdit,
    onClose,
}: {
    patient: PatientRow
    onEdit: () => void
    onClose: () => void
}) {
    const { language, isArabic } = usePageLanguage()

    return (
        <Overlay onClose={onClose} wide isArabic={isArabic}>
            <div className="flex items-start justify-between gap-4 border-b p-4 sm:p-5">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <Avatar name={patient.name} large />

                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold">
                            {patient.name}
                        </h2>

                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5 break-all">
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                {patient.email}
                            </span>

                            {patient.phone && (
                                <span
                                    className="flex items-center gap-1.5"
                                    dir="auto"
                                >
                                    <Phone className="h-3.5 w-3.5" />
                                    {patient.phone}
                                </span>
                            )}

                            <span className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                {t(language, "Joined")} {patient.joined}
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t(language, "Close")}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MiniStat
                        label={t(language, "Total visits")}
                        value={String(patient.totalVisits)}
                    />
                    <MiniStat
                        label={t(language, "Completed")}
                        value={String(patient.completedVisits)}
                    />
                    <MiniStat
                        label={t(language, "Active")}
                        value={String(patient.activeVisits)}
                    />
                    <MiniStat
                        label={t(language, "Total billed")}
                        value={currency.format(patient.totalSpent)}
                    />
                </div>

                <section className="space-y-2">
                    <h3 className="text-sm font-semibold">
                        {t(language, "Appointment History")}
                    </h3>

                    <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
                        {patient.visits.length === 0 ? (
                            <p className="p-6 text-center text-sm text-muted-foreground">
                                {t(
                                    language,
                                    "This patient has not booked any appointments yet."
                                )}
                            </p>
                        ) : (
                            patient.visits.map((visit) => (
                                <div
                                    key={visit.id}
                                    className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold">
                                            {visit.doctor}
                                        </p>

                                        <p
                                            className="truncate text-xs text-muted-foreground"
                                            dir="auto"
                                        >
                                            {visit.specialty && (
                                                <>
                                                    {visit.specialty} ·{" "}
                                                </>
                                            )}
                                            {visit.date} · {visit.time}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        {visit.type === "video" ? (
                                            <Video
                                                className="h-4 w-4 text-blue-600"
                                                aria-label={t(
                                                    language,
                                                    "Tele-health"
                                                )}
                                            />
                                        ) : (
                                            <MapPin
                                                className="h-4 w-4 text-orange-600"
                                                aria-label={t(
                                                    language,
                                                    "In-clinic"
                                                )}
                                            />
                                        )}

                                        <Badge
                                            variant={badgeVariant(
                                                visit.status
                                            )}
                                        >
                                            {statusLabel(
                                                visit.status,
                                                language
                                            )}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t(language, "Close")}
                    </Button>

                    <Button
                        className="gap-2"
                        onClick={onEdit}
                    >
                        <Edit className="h-4 w-4" />
                        {t(language, "Edit Patient")}
                    </Button>
                </div>
            </div>
        </Overlay>
    )
}

function DeleteButton({
    patient,
}: {
    patient: PatientRow
}) {
    const [pending, setPending] = useState(false)
    const { language } = usePageLanguage()

    async function handle() {
        if (patient.activeVisits > 0) {
            window.alert(
                t(language, "Patient has active appointments")
            )
            return
        }

        if (
            !window.confirm(
                `${t(language, "Delete")} ${patient.name}? ${t(
                    language,
                    "This cannot be undone."
                )}`
            )
        ) {
            return
        }

        setPending(true)

        try {
            const result = await deletePatient(patient.id)

            if (result?.error) {
                window.alert(result.error)
            }
        } catch {
            window.alert(
                t(
                    language,
                    "Could not delete this patient. Please try again."
                )
            )
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
            title={t(language, "Delete patient")}
            aria-label={t(language, "Delete patient")}
        >
            {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Trash2 className="h-4 w-4" />
            )}
        </Button>
    )
}

type PatientsManagerProps = {
    patients: PatientRow[]
    initialSelectedPatientId?: string
}

export function PatientsManager({
    patients,
    initialSelectedPatientId,
}: PatientsManagerProps) {
    const { language, isArabic } = usePageLanguage()

    const [searchTerm, setSearchTerm] = useState("")
    const [filter, setFilter] = useState<
        "all" | "upcoming" | "new" | "no-visits"
    >("all")
    const [dialog, setDialog] = useState<
        | null
        | { mode: "create" }
        | { mode: "edit"; patient: PatientRow }
    >(null)
  const [detailsId, setDetailsId] = useState<string | null>(
    initialSelectedPatientId ?? null
)

    const details = detailsId
        ? patients.find((patient) => patient.id === detailsId) ?? null
        : null

    const term = searchTerm.trim().toLocaleLowerCase()

    const filtered = patients.filter(
        (patient) =>
            matchesFilter(patient, filter) &&
            (!term ||
                patient.name.toLocaleLowerCase().includes(term) ||
                patient.email.toLocaleLowerCase().includes(term) ||
                patient.phone.toLocaleLowerCase().includes(term))
    )

    const filters = [
        { key: "all" as const, label: t(language, "All") },
        {
            key: "upcoming" as const,
            label: t(language, "Upcoming visit"),
        },
        {
            key: "new" as const,
            label: t(language, "New (30 days)"),
        },
        {
            key: "no-visits" as const,
            label: t(language, "No visits"),
        },
    ]

    const stats = [
        {
            title: t(language, "Total Patients"),
            value: patients.length,
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-100 dark:bg-blue-900/20",
        },
        {
            title: t(language, "New (30 days)"),
            value: patients.filter((patient) => patient.isNew).length,
            icon: UserPlus,
            color: "text-orange-600",
            bg: "bg-orange-100 dark:bg-orange-900/20",
        },
        {
            title: t(language, "With Upcoming Visit"),
            value: patients.filter((patient) => patient.nextVisit).length,
            icon: CalendarClock,
            color: "text-purple-600",
            bg: "bg-purple-100 dark:bg-purple-900/20",
        },
        {
            title: t(language, "Completed Visits"),
            value: patients.reduce(
                (sum, patient) => sum + patient.completedVisits,
                0
            ),
            icon: CheckCheck,
            color: "text-emerald-600",
            bg: "bg-emerald-100 dark:bg-emerald-900/20",
        },
    ]

    return (
        <div
            dir={isArabic ? "rtl" : "ltr"}
            className="min-w-0 space-y-6 animate-in fade-in duration-300 sm:space-y-8"
        >
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        {t(language, "Patient Management")}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t(
                            language,
                            "View patient records, visit history, and manage accounts."
                        )}
                    </p>
                </div>

                <Button
                    className="gap-2 self-start md:self-auto"
                    onClick={() => setDialog({ mode: "create" })}
                >
                    <Plus className="h-4 w-4" />
                    {t(language, "Add New Patient")}
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {stats.map((stat) => {
                    const Icon = stat.icon

                    return (
                        <div
                            key={stat.title}
                            className="rounded-xl border bg-card/60 p-3 shadow-sm sm:rounded-2xl sm:p-5"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                                    {stat.title}
                                </span>
                                <div
                                    className={cn(
                                        "shrink-0 rounded-lg p-2",
                                        stat.bg
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "h-4 w-4",
                                            stat.color
                                        )}
                                    />
                                </div>
                            </div>

                            <p className="mt-2 text-xl font-bold sm:mt-3 sm:text-2xl">
                                {stat.value.toLocaleString(
                                    isArabic ? "ar" : "en-US"
                                )}
                            </p>
                        </div>
                    )
                })}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative w-full min-w-0 flex-1">
                    <Search
                        className={cn(
                            "absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
                            isArabic ? "right-3" : "left-3"
                        )}
                    />

                    <Input
                        placeholder={t(
                            language,
                            "Search by name, email or phone..."
                        )}
                        className={cn(
                            "h-10 bg-card shadow-sm",
                            isArabic ? "pr-9" : "pl-9"
                        )}
                        value={searchTerm}
                        onChange={(event) =>
                            setSearchTerm(event.target.value)
                        }
                        aria-label={t(
                            language,
                            "Search by name, email or phone..."
                        )}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {filters.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setFilter(item.key)}
                            className={cn(
                                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:px-4",
                                filter === item.key
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-transparent bg-card text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {item.label}
                            <span
                                className={cn(
                                    "opacity-70",
                                    isArabic ? "mr-2" : "ml-2"
                                )}
                            >
                                {
                                    patients.filter((patient) =>
                                        matchesFilter(patient, item.key)
                                    ).length
                                }
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card/60 shadow-sm sm:rounded-2xl">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-muted/50 bg-muted/30 hover:bg-muted/30">
                                <TableHead
                                    className={cn(
                                        "w-10 whitespace-nowrap",
                                        isArabic
                                            ? "pr-4 text-right"
                                            : "pl-4 text-left"
                                    )}
                                >
                                    #
                                </TableHead>

                                <TableHead
                                    className={cn(
                                        "min-w-[210px] whitespace-nowrap",
                                        isArabic ? "text-right" : "text-left"
                                    )}
                                >
                                    {t(language, "Patient")}
                                </TableHead>

                                <TableHead
                                    className={cn(
                                        "min-w-[125px] whitespace-nowrap",
                                        isArabic ? "text-right" : "text-left"
                                    )}
                                >
                                    {t(language, "Phone")}
                                </TableHead>

                                <TableHead
                                    className={cn(
                                        "min-w-[115px] whitespace-nowrap",
                                        isArabic ? "text-right" : "text-left"
                                    )}
                                >
                                    {t(language, "Joined")}
                                </TableHead>

                                <TableHead
                                    className={cn(
                                        "min-w-[90px] whitespace-nowrap",
                                        isArabic ? "text-right" : "text-left"
                                    )}
                                >
                                    {t(language, "Visits")}
                                </TableHead>

                                <TableHead
                                    className={cn(
                                        "min-w-[115px] whitespace-nowrap",
                                        isArabic ? "text-right" : "text-left"
                                    )}
                                >
                                    {t(language, "Last Visit")}
                                </TableHead>

                                <TableHead
                                    className={cn(
                                        "min-w-[150px] whitespace-nowrap",
                                        isArabic ? "text-right" : "text-left"
                                    )}
                                >
                                    {t(language, "Next Appointment")}
                                </TableHead>

                                <TableHead
                                    className={cn(
                                        "min-w-[115px] whitespace-nowrap",
                                        isArabic
                                            ? "pl-4 text-left"
                                            : "pr-4 text-right"
                                    )}
                                >
                                    {t(language, "Actions")}
                                </TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="py-12 text-center text-sm text-muted-foreground"
                                    >
                                        {patients.length === 0
                                            ? t(
                                                  language,
                                                  "No patients yet. Patients appear here once they register or you add one."
                                              )
                                            : t(
                                                  language,
                                                  "No patients match your search."
                                              )}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((patient, index) => (
                                    <TableRow
                                        key={patient.id}
                                        className="border-muted/30 transition-colors hover:bg-accent/30"
                                    >
                                        <TableCell
                                            className={cn(
                                                "font-mono text-xs text-muted-foreground",
                                                isArabic ? "pr-4" : "pl-4"
                                            )}
                                        >
                                            {index + 1}
                                        </TableCell>

                                        <TableCell>
                                            <button
                                                type="button"
                                                className={cn(
                                                    "flex max-w-full items-center gap-2.5",
                                                    isArabic
                                                        ? "text-right"
                                                        : "text-left"
                                                )}
                                                onClick={() =>
                                                    setDetailsId(patient.id)
                                                }
                                            >
                                                <Avatar name={patient.name} />

                                                <span className="min-w-0">
                                                    <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                                                        <span className="max-w-[180px] truncate">
                                                            {patient.name}
                                                        </span>

                                                        {patient.isNew && (
                                                            <Badge variant="success">
                                                                {t(
                                                                    language,
                                                                    "New"
                                                                )}
                                                            </Badge>
                                                        )}
                                                    </span>

                                                    <span
                                                        className="block max-w-[190px] truncate text-xs text-muted-foreground"
                                                        dir="ltr"
                                                    >
                                                        {patient.email}
                                                    </span>
                                                </span>
                                            </button>
                                        </TableCell>

                                        <TableCell
                                            className="whitespace-nowrap text-sm"
                                            dir="auto"
                                        >
                                            {patient.phone || (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                            {patient.joined}
                                        </TableCell>

                                        <TableCell>
                                            <span className="font-semibold">
                                                {patient.totalVisits}
                                            </span>
                                            <span className="block whitespace-nowrap text-xs text-muted-foreground">
                                                {patient.completedVisits}{" "}
                                                {t(language, "completed")}
                                            </span>
                                        </TableCell>

                                        <TableCell className="whitespace-nowrap text-sm">
                                            {patient.lastVisit ?? (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell className="whitespace-nowrap text-sm">
                                            {patient.nextVisit ? (
                                                <span className="font-medium text-primary">
                                                    {patient.nextVisit}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {t(language, "None scheduled")}
                                                </span>
                                            )}
                                        </TableCell>

                                        <TableCell
                                            className={cn(
                                                isArabic ? "pl-4" : "pr-4"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "flex items-center gap-0.5",
                                                    isArabic
                                                        ? "justify-start"
                                                        : "justify-end"
                                                )}
                                            >
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                    onClick={() =>
                                                        setDetailsId(patient.id)
                                                    }
                                                    title={t(
                                                        language,
                                                        "View details"
                                                    )}
                                                    aria-label={t(
                                                        language,
                                                        "View details"
                                                    )}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                    onClick={() =>
                                                        setDialog({
                                                            mode: "edit",
                                                            patient,
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

                                                <DeleteButton patient={patient} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {details && !dialog && (
                <DetailsDialog
                    patient={details}
                    onEdit={() =>
                        setDialog({
                            mode: "edit",
                            patient: details,
                        })
                    }
                    onClose={() => setDetailsId(null)}
                />
            )}

            {dialog && (
                <PatientDialog
                    patient={
                        dialog.mode === "edit"
                            ? dialog.patient
                            : null
                    }
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    )
}

function Avatar({
    name,
    large,
}: {
    name: string
    large?: boolean
}) {
    return (
        <div
            className={cn(
                "flex shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 font-bold text-primary",
                large ? "h-14 w-14 text-lg" : "h-9 w-9 text-xs"
            )}
        >
            {initials(name) || "?"}
        </div>
    )
}

function MiniStat({
    label,
    value,
}: {
    label: string
    value: string
}) {
    return (
        <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="break-words text-base font-bold sm:text-lg">
                {value}
            </p>
        </div>
    )
}

function Overlay({
    children,
    onClose,
    wide,
    isArabic,
}: {
    children: React.ReactNode
    onClose: () => void
    wide?: boolean
    isArabic: boolean
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4"
            onClick={onClose}
        >
            <div
                dir={isArabic ? "rtl" : "ltr"}
                role="dialog"
                aria-modal="true"
                className={cn(
                    "max-h-[90vh] w-full overflow-y-auto rounded-2xl border bg-card shadow-xl",
                    wide ? "max-w-2xl" : "max-w-xl"
                )}
                onClick={(event) => event.stopPropagation()}
            >
                {children}
            </div>
        </div>
    )
}

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