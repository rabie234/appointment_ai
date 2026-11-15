"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import {
    cancelMyLeaveRequest,
    requestMyLeave,
    type LeaveRequestState,
} from "../account/leave-actions"
import { Loader2 } from "lucide-react"

export type DoctorLeaveRequest = {
    id: string
    startDate: string
    endDate: string
    reason: string
    status: "pending" | "approved" | "rejected" | "cancelled"
    adminNote: string
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

function LeaveFeedback({
    state,
    language,
}: {
    state: LeaveRequestState
    language: "ar" | "en"
}) {
    if (state.error) {
        return (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {t(language, state.error)}
            </p>
        )
    }

    if (state.success) {
        return (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                {t(language, state.success)}
            </p>
        )
    }

    return null
}

export function LeaveRequestsManager({
    leaveRequests,
}: {
    leaveRequests: DoctorLeaveRequest[]
}) {
    const { language } = useLanguage()
    const router = useRouter()
    const [cancellingLeaveId, setCancellingLeaveId] = useState<string | null>(null)
    const [leaveRequest, leaveRequestAction] =
        useActionState<LeaveRequestState, FormData>(requestMyLeave, {})

    async function handleCancelLeaveRequest(leaveId: string) {
        if (!window.confirm(t(language, "Cancel this pending leave request?"))) {
            return
        }

        setCancellingLeaveId(leaveId)

        try {
            const result = await cancelMyLeaveRequest(leaveId)

            if (result.error) {
                window.alert(t(language, result.error))
                return
            }

            router.refresh()
        } catch {
            window.alert(
                t(language, "Could not cancel your leave request. Please try again.")
            )
        } finally {
            setCancellingLeaveId(null)
        }
    }

    return (
        <div
            className="space-y-8 animate-in fade-in duration-500"
            dir={language === "ar" ? "rtl" : "ltr"}
        >
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    {t(language, "My Leave Requests")}
                </h1>
                <p className="mt-1 text-muted-foreground">
                    {t(language, "Leave requests need administrator approval.")}
                </p>
            </div>

            <div className="max-w-3xl space-y-8">
                <section className="rounded-xl border bg-card/60 p-6 shadow-sm">
                    <form action={leaveRequestAction} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">
                                    {t(language, "Start Date")}
                                </span>
                                <Input name="startDate" type="date" required />
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">
                                    {t(language, "End Date")}
                                </span>
                                <Input name="endDate" type="date" required />
                            </label>
                        </div>

                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">
                                {t(language, "Reason")}
                            </span>
                            <Input name="reason" maxLength={500} />
                            <span className="block text-xs text-muted-foreground">
                                {t(language, "Optional")}
                            </span>
                        </label>

                        <LeaveFeedback state={leaveRequest} language={language} />

                        <div className="flex justify-end">
                            <SubmitButton>
                                {t(language, "Submit Leave Request")}
                            </SubmitButton>
                        </div>
                    </form>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">
                        {t(language, "Request History")}
                    </h2>

                    {leaveRequests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t(language, "You have no leave requests.")}
                        </p>
                    ) : (
                        leaveRequests.map((leave) => (
                            <div
                                key={leave.id}
                                className="space-y-2 rounded-lg border bg-card/60 p-4"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-medium">
                                        {leave.startDate} – {leave.endDate}
                                    </p>
                                    <Badge variant="secondary">
                                        {t(language, leave.status)}
                                    </Badge>
                                </div>

                                {leave.status === "pending" && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={cancellingLeaveId === leave.id}
                                        onClick={() =>
                                            handleCancelLeaveRequest(leave.id)
                                        }
                                    >
                                        {cancellingLeaveId === leave.id
                                            ? t(language, "Cancelling...")
                                            : t(language, "Cancel request")}
                                    </Button>
                                )}

                                {leave.reason && (
                                    <p className="text-sm text-muted-foreground">
                                        {t(language, "Reason")}: {leave.reason}
                                    </p>
                                )}

                                {leave.adminNote && (
                                    <p className="text-sm">
                                        {t(language, "Administrator note")}: {leave.adminNote}
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </section>
            </div>
        </div>
    )
}