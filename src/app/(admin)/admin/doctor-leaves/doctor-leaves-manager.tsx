
"use client"

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
import Doctor from "@/models/Doctor"
import DoctorLeave from "@/models/DoctorLeave"

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
    specialty: string
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
                "Are you sure you want to cancel this doctor leave?"
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
            window.alert("Could not cancel leave. Please try again.")
        } finally {
            setCancellingId(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Search and status filter */}
            <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                        placeholder="Search doctor, specialty, or reason..."
                        className="h-11 pl-10"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(event) =>
                        setStatusFilter(event.target.value)
                    }
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                    aria-label="Filter leaves by status"
                >
                    <option value="All">All leave records</option>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Past">Past</option>
                </select>
            </div>

            {/* Leave statistics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(["Upcoming", "Ongoing", "Past"] as const).map(
                    (status) => (
                        <div
                            key={status}
                            className="rounded-xl border bg-card p-4"
                        >
                            <p className="text-sm text-muted-foreground">
                                {status} leaves
                            </p>

                            <p className="mt-1 text-2xl font-bold">
                                {
                                    leaves.filter(
                                        (leave) => leave.status === status
                                    ).length
                                }
                            </p>
                        </div>
                    )
                )}
            </div>

            {/* Doctor leaves table */}
            <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr className="text-left">
                            <th className="p-4">Doctor</th>
                            <th className="p-4">Specialty</th>
                            <th className="p-4">Start Date</th>
                            <th className="p-4">End Date</th>
                            <th className="p-4">Reason</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">
                                Affected Appointments
                            </th>
                            <th className="p-4">Actions</th>
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
                                    No matching leave records found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((leave) => (
                                <tr
                                    key={leave.id}
                                    className="border-t"
                                >
                                    <td className="p-4 font-medium">
                                        {leave.doctorName}
                                    </td>

                                    <td className="p-4">
                                        {leave.specialty}
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
                                            {leave.status}
                                        </span>
                                    </td>

                                    {/* Clickable affected appointment count */}
                                    <td className="p-4">
                                        {leave.affectedCount > 0 ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedLeave(leave)
                                                }
                                                className="font-semibold text-red-600 underline underline-offset-4 hover:text-red-700"
                                                aria-label={`View ${leave.affectedCount} affected appointments for ${leave.doctorName}`}
                                            >
                                                {leave.affectedCount}
                                            </button>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                0
                                            </span>
                                        )}
                                    </td>

                                    {/* Cancel leave */}
                                    <td className="p-4">
                                        {leave.status !== "Past" && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={
                                                    cancellingId === leave.id
                                                }
                                                onClick={() =>
                                                    handleCancelLeave(leave.id)
                                                }
                                                className="gap-2 text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                {cancellingId === leave.id
                                                    ? "Cancelling..."
                                                    : "Cancel"}
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
                    if (!open) setSelectedLeave(null)
                }}
            >
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            Affected Appointments
                        </DialogTitle>

                        <DialogDescription>
                            {selectedLeave
                                ? `${selectedLeave.doctorName} — ${selectedLeave.startDate} to ${selectedLeave.endDate}`
                                : "Appointments affected by doctor leave."}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLeave && (
                        <div className="max-h-[60vh] overflow-auto rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-muted">
                                    <tr className="text-left">
                                        <th className="p-3">Patient</th>
                                        <th className="p-3">Email</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Time</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Status</th>
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
                                                No affected appointments found.
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
                                                        {appointment.type}
                                                    </td>

                                                    <td className="p-3">
                                                        {appointment.status}
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
