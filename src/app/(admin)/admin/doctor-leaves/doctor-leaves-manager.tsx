
"use client"

import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Search,
    CalendarDays,
    Trash2,
} from "lucide-react"
import { cancelDoctorLeave } from "../doctors/leave-actions"

export type AffectedAppointmentRow = {
    id: string
    patientName: string
    patientEmail: string
    date: string
    time: string
    status: string
    type: string
}

export type DoctorLeaveRow = {
    id: string
    doctorName: string
    doctorNameAr: string
    specialty: string
    specialtyAr: string
    startDate: string
    endDate: string
    reason: string
    status: "Upcoming" | "Ongoing" | "Past"
    affectedCount: number
    affectedAppointments: AffectedAppointmentRow[]
}

export function DoctorLeavesManager({
    leaves,
}: {
    leaves: DoctorLeaveRow[]
}) {
    const { language } = useLanguage()
    const isArabic = language === "ar"

    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("All")
    const [selectedLeave, setSelectedLeave] =
        useState<DoctorLeaveRow | null>(null)
    const [cancellingId, setCancellingId] =
        useState<string | null>(null)

    const router = useRouter()

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()

        return leaves.filter((leave) => {
            const matchesSearch =
                !term ||
                leave.doctorName.toLowerCase().includes(term) ||
                leave.specialty.toLowerCase().includes(term) ||
                leave.reason.toLowerCase().includes(term)

            const matchesStatus =
                statusFilter === "All" ||
                leave.status === statusFilter

            return matchesSearch && matchesStatus
        })
    }, [leaves, search, statusFilter])

    async function handleCancelLeave(leaveId: string) {
        if (
            !window.confirm(
                t(
                    language,
                    "Are you sure you want to cancel this doctor leave?"
                )
            )
        ) {
            return
        }

        setCancellingId(leaveId)

        try {
            const result = await cancelDoctorLeave(leaveId)

            if (result.error) {
                window.alert(result.error)
                return
            }

            setSelectedLeave(null)
            router.refresh()
        } catch {
            window.alert(
                t(
                    language,
                    "Could not cancel leave. Please try again."
                )
            )
        } finally {
            setCancellingId(null)
        }
    }

    return (
        <div
            className="space-y-6"
            dir={isArabic ? "rtl" : "ltr"}
        >
            {/* Search and status filter */}
            <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                    <Search
                        className={`absolute ${
                            isArabic ? "right-3" : "left-3"
                        } top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground`}
                    />

                    <Input
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                        placeholder={t(
                            language,
                            "Search doctor, specialty, or reason..."
                        )}
                        className={`h-11 ${
                            isArabic
                                ? "pr-10 text-right"
                                : "pl-10"
                        }`}
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(event) =>
                        setStatusFilter(event.target.value)
                    }
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                    aria-label={t(
                        language,
                        "Filter leaves by status"
                    )}
                >
                    <option value="All">
                        {t(language, "All leave records")}
                    </option>
                    <option value="Upcoming">
                        {t(language, "Upcoming")}
                    </option>
                    <option value="Ongoing">
                        {t(language, "Ongoing")}
                    </option>
                    <option value="Past">
                        {t(language, "Past")}
                    </option>
                </select>
            </div>

            {/* Leave statistics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(
                    ["Upcoming", "Ongoing", "Past"] as const
                ).map((status) => (
                    <div
                        key={status}
                        className="rounded-xl border bg-card p-4"
                    >
                        <p className="text-sm text-muted-foreground">
                            {t(language, status)}{" "}
                            {t(language, "leaves")}
                        </p>

                        <p className="mt-1 text-2xl font-bold">
                            {
                                leaves.filter(
                                    (leave) =>
                                        leave.status === status
                                ).length
                            }
                        </p>
                    </div>
                ))}
            </div>

            {/* Doctor leaves table */}
            <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr
                            className={
                                isArabic
                                    ? "text-right"
                                    : "text-left"
                            }
                        >
                            <th className="p-4">
                                {t(language, "Doctor")}
                            </th>
                            <th className="p-4">
                                {t(language, "Specialty")}
                            </th>
                            <th className="p-4">
                                {t(language, "Start Date")}
                            </th>
                            <th className="p-4">
                                {t(language, "End Date")}
                            </th>
                            <th className="p-4">
                                {t(language, "Reason")}
                            </th>
                            <th className="p-4">
                                {t(language, "Status")}
                            </th>
                            <th className="p-4">
                                {t(language, "Affected Appointments")}
                            </th>
                            <th className="p-4">
                                {t(language, "Actions")}
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="p-8 text-center text-muted-foreground"
                                >
                                    <CalendarDays className="mx-auto mb-2 h-6 w-6" />
                                    {t(
                                        language,
                                        "No matching leave records found."
                                    )}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((leave) => (
                                <tr
                                    key={leave.id}
                                    className="border-t"
                                >
                                    <td className="p-4 font-medium">
                                       {isArabic
        ? leave.doctorNameAr || leave.doctorName
        : leave.doctorName}
                                    </td>

                                    <td className="p-4">
                                        {isArabic
        ? leave.specialtyAr 
        : leave.specialty}
                                    </td>

                                    <td className="p-4">
                                        {leave.startDate}
                                    </td>

                                    <td className="p-4">
                                        {leave.endDate}
                                    </td>

                                    <td className="p-4">
                                        {leave.reason || "—"}
                                    </td>

                                    <td className="p-4">
                                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                                            {t(language, leave.status)}
                                        </span>
                                    </td>

                                    <td className="p-4">
                                        {leave.affectedCount > 0 ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedLeave(
                                                        leave
                                                    )
                                                }
                                                className="font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
                                                aria-label={
                                                    isArabic
                                                        ? `عرض ${leave.affectedCount} من المواعيد المتأثرة للطبيب ${leave.doctorName}`
                                                        : `View ${leave.affectedCount} affected appointments for ${leave.doctorName}`
                                                }
                                            >
                                                {leave.affectedCount}
                                            </button>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                0
                                            </span>
                                        )}
                                    </td>

                                    <td className="p-4">
                                        {leave.status !== "Past" && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={
                                                    cancellingId ===
                                                    leave.id
                                                }
                                                onClick={() =>
                                                    handleCancelLeave(
                                                        leave.id
                                                    )
                                                }
                                                className="gap-2 text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />

                                                {cancellingId ===
                                                leave.id
                                                    ? t(
                                                          language,
                                                          "Cancelling..."
                                                      )
                                                    : t(
                                                          language,
                                                          "Cancel"
                                                      )}
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Affected appointments dialog */}
            <Dialog
                open={selectedLeave !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedLeave(null)
                    }
                }}
            >
                <DialogContent
                    className="max-w-4xl"
                    dir={isArabic ? "rtl" : "ltr"}
                >
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                language,
                                "Affected Appointments"
                            )}
                        </DialogTitle>

                        <DialogDescription>
                           {selectedLeave
    ? `${isArabic ? selectedLeave.doctorNameAr : selectedLeave.doctorName} — ${selectedLeave.startDate} ${t(language, "to")} ${selectedLeave.endDate}`
    : t(language, "Appointments affected by doctor leave.")}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLeave && (
                        <div className="max-h-[60vh] overflow-auto rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-muted">
                                    <tr
                                        className={
                                            isArabic
                                                ? "text-right"
                                                : "text-left"
                                        }
                                    >
                                        <th className="p-3">
                                            {t(language, "Patient")}
                                        </th>
                                        <th className="p-3">
                                            {t(language, "Email")}
                                        </th>
                                        <th className="p-3">
                                            {t(language, "Date")}
                                        </th>
                                        <th className="p-3">
                                            {t(language, "Time")}
                                        </th>
                                        <th className="p-3">
                                            {t(language, "Type")}
                                        </th>
                                        <th className="p-3">
                                            {t(language, "Status")}
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {selectedLeave.affectedAppointments.length ===
                                    0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="p-6 text-center text-muted-foreground"
                                            >
                                                {t(
                                                    language,
                                                    "No affected appointments found."
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedLeave.affectedAppointments.map(
                                            (appointment) => (
                                                <tr
                                                    key={appointment.id}
                                                    className="border-t"
                                                >
                                                    <td className="p-3 font-medium">
                                                        {appointment.patientName}
                                                    </td>

                                                    <td className="p-3">
                                                        {appointment.patientEmail ||
                                                            "—"}
                                                    </td>

                                                    <td className="p-3">
                                                        {appointment.date}
                                                    </td>

                                                    <td className="p-3">
                                                        {appointment.time}
                                                    </td>

                                                    <td className="p-3">
                                                        {t(
                                                            language,
                                                            appointment.type
                                                        )}
                                                    </td>

                                                    <td className="p-3">
                                                        {t(
                                                            language,
                                                            appointment.status
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
