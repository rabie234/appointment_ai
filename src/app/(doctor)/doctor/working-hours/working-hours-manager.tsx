"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import { WeekEditor } from "@/components/schedule/week-editor"
import { toMinutes, type DayHours } from "@/lib/schedule"
import {
    acknowledgeClinicHours,
    requestMyScheduleChange,
    type AccountFormState,
} from "../account/actions"
import { Loader2 } from "lucide-react"

export type ScheduleChangeRequestView = {
    id: string
    requestedSchedule: DayHours[]
    status: "pending" | "approved" | "rejected" | "cancelled"
    adminNote: string
    requestedAt: string
}

function SubmitButton({
    disabled,
    children,
}: {
    disabled?: boolean
    children: React.ReactNode
}) {
    const { pending } = useFormStatus()

    return (
        <Button
            type="submit"
            disabled={disabled || pending}
            className="gap-2"
        >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {children}
        </Button>
    )
}

function ScheduleFeedback({
    state,
    language,
}: {
    state: AccountFormState
    language: "ar" | "en"
}) {
    if (state.error) {
        return (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t(language, state.error)}
            </p>
        )
    }

    if (state.success) {
        return (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                {t(language, state.success)}
            </p>
        )
    }

    return null
}

export function WorkingHoursManager({
    currentSchedule,
    clinicSchedule,
    clinicHoursVersion,
    acknowledgedClinicHoursVersion,
    requests,
}: {
    currentSchedule: DayHours[]
    clinicSchedule: DayHours[]
    clinicHoursVersion: string
    acknowledgedClinicHoursVersion: string
    requests: ScheduleChangeRequestView[]
}) {
    const { language } = useLanguage()
    const hasPendingRequest = requests.some(
        (request) => request.status === "pending"
    )

    const [state, formAction] =
        useActionState<AccountFormState, FormData>(
            requestMyScheduleChange,
            {}
        )

    const clinicByDay = new Map(clinicSchedule.map((day) => [day.day, day]))
    const conflictAt = (day: DayHours) => {
        const clinicDay = clinicByDay.get(day.day)
        if (day.closed) return { open: false, close: false }
        if (!clinicDay || clinicDay.closed) return { open: true, close: true }
        return {
            open: toMinutes(day.open) < toMinutes(clinicDay.open),
            close: toMinutes(day.close) > toMinutes(clinicDay.close),
        }
    }
    const hasClinicHoursConflict = currentSchedule.some((day) => {
        const conflict = conflictAt(day)
        return conflict.open || conflict.close
    })
    const clinicHoursApplied =
        !hasClinicHoursConflict &&
        clinicHoursVersion === acknowledgedClinicHoursVersion
    const dateFormatter = new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
    )

    return (
        <div
            className="space-y-8 animate-in fade-in duration-500"
            dir={language === "ar" ? "rtl" : "ltr"}
        >
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    {t(language, "Working Hours")}
                </h1>
                <p className="mt-1 text-muted-foreground">
                    {t(language, "Schedule changes need administrator approval.")}
                </p>
            </div>

            {clinicHoursApplied ? (
                <Card className="bg-card/60">
                    <CardHeader>
                        <CardTitle className="text-xl">{t(language, "Saved doctor working hours")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[420px] border-collapse text-sm">
                                <thead>
                                    <tr className="border-b text-start text-muted-foreground">
                                        <th scope="col" className="px-3 py-3 text-start font-medium">{t(language, "Day")}</th>
                                        <th scope="col" className="px-3 py-3 text-start font-medium">{t(language, "Saved doctor working hours")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentSchedule.map((day) => (
                                        <tr key={day.day} className="border-b last:border-0">
                                            <th scope="row" className="px-3 py-3 text-start font-medium">{t(language, day.day)}</th>
                                            <td className="px-3 py-3 tabular-nums">{day.closed ? t(language, "Off") : day.open + "–" + day.close}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="bg-card/60">
                        <CardHeader><CardTitle className="text-xl">{t(language, "Saved doctor working hours")}</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            {currentSchedule.map((day) => {
                                const conflict = conflictAt(day)
                                return (
                                    <div key={day.day} className="flex justify-between gap-3 text-sm">
                                        <span>{t(language, day.day)}</span>
                                        <span className="tabular-nums">
                                            {day.closed ? t(language, "Off") : (
                                                <>
                                                    {day.open}{hasClinicHoursConflict && conflict.open && <span aria-hidden="true" className="ml-1 text-xs font-bold text-red-600">*</span>}
                                                    –{day.close}{hasClinicHoursConflict && conflict.close && <span aria-hidden="true" className="ml-1 text-xs font-bold text-red-600">*</span>}
                                                </>
                                            )}
                                        </span>
                                    </div>
                                )
                            })}
                        </CardContent>
                    </Card>
                    <Card className="bg-card/60">
                        <CardHeader><CardTitle className="text-xl">{t(language, "Current clinic hours")}</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            {clinicSchedule.map((day) => (
                                <div key={day.day} className="flex justify-between gap-3 text-sm">
                                    <span>{t(language, day.day)}</span>
                                    <span className="tabular-nums">{day.closed ? t(language, "Off") : day.open + "–" + day.close}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

            )}
            {clinicHoursApplied && (
                    <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                        {t(language, "Current clinic hours were applied to your saved schedule. You can request changes below.")}
                    </p>
                )}
            {hasClinicHoursConflict && (
                <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    <p>{t(language, "Your saved working hours extend beyond the current clinic hours. The red star marks the conflicting time. Continuing will replace your saved schedule with the current clinic hours. You can request changes afterward.")}</p>
                    <form action={acknowledgeClinicHours}>
                        <SubmitButton>{t(language, "I Reviewed and Apply Clinic Hours")}</SubmitButton>
                    </form>
                </div>
            )}
            <Card className="border-none bg-card/60 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-xl">
                        {t(language, "Request a schedule change")}
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    {hasPendingRequest && (
                        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                            {t(
                                language,
                                "You already have a pending schedule-change request."
                            )}
                        </p>
                    )}

                    <form action={formAction} className="max-w-2xl space-y-4">
                        <fieldset disabled={hasPendingRequest} className="space-y-4">
                            <WeekEditor
                                prefix="doctor"
                                initial={currentSchedule}
                                closedLabel={t(language, "Off")}
                            />

                            <ScheduleFeedback state={state} language={language} />

                            <div className="flex justify-end">
                                <SubmitButton disabled={hasPendingRequest}>
                                    {t(language, "Submit schedule change")}
                                </SubmitButton>
                            </div>
                        </fieldset>
                    </form>
                </CardContent>
            </Card>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">
                    {t(language, "Schedule change history")}
                </h2>

                {requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t(language, "No schedule change requests yet.")}
                    </p>
                ) : (
                    requests.map((request) => (
                        <Card key={request.id} className="bg-card/60">
                            <CardContent className="space-y-3 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm text-muted-foreground">
                                        {dateFormatter.format(
                                            new Date(request.requestedAt)
                                        )}
                                    </p>
                                    <Badge variant="secondary">
                                        {t(language, request.status)}
                                    </Badge>
                                </div>

                                <div className="grid gap-1 text-sm sm:grid-cols-2">
                                    {request.requestedSchedule.map((day) => (
                                        <p key={day.day}>
                                            {t(language, day.day)}:{" "}
                                            {day.closed
                                                ? t(language, "Off")
                                                : `${day.open}–${day.close}`}
                                        </p>
                                    ))}
                                </div>

                                {request.adminNote && (
                                    <p className="border-t pt-3 text-sm">
                                        {t(language, "Administrator note")}:{" "}
                                        {request.adminNote}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </section>
        </div>
    )
}
