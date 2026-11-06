"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { DayHours } from "@/lib/schedule"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/components/i18n/language-provider"
import { t } from "@/components/i18n/translations"
import {
    approveScheduleChange,
    rejectScheduleChange,
} from "./actions"
import { Loader2 } from "lucide-react"

type ScheduleConflict = {
    id: string
    patientName: string
    date: string
    time: string
    status: string
    rescheduleRequested: boolean
}

export type ScheduleRequestRow = {
    id: string
    doctorName: string
    doctorNameAr: string
    specialty: string
    doctorExists: boolean
    currentSchedule: DayHours[]
    requestedSchedule: DayHours[]
    reason: string
    requestedAt: string
    conflicts: ScheduleConflict[]
}

function ScheduleColumn({
    title,
    schedule,
    language,
}: {
    title: string
    schedule: DayHours[]
    language: "en" | "ar"
}) {
    return (
        <div className="space-y-2 rounded-lg border p-3">
            <h3 className="font-semibold">{t(language, title)}</h3>

            {schedule.map((day) => (
                <p key={day.day} className="flex justify-between gap-3 text-sm">
                    <span>{t(language, day.day)}</span>
                    <span className="text-muted-foreground" dir="ltr">
                        {day.closed
                            ? t(language, "Off")
                            : `${day.open}–${day.close}`}
                    </span>
                </p>
            ))}
        </div>
    )
}

export function ScheduleRequestsManager({
    requests,
}: {
    requests: ScheduleRequestRow[]
}) {
    const { language } = useLanguage()
    const router = useRouter()
    const [reviewingId, setReviewingId] = useState<string | null>(null)
    const [notes, setNotes] = useState<Record<string, string>>({})

    async function reviewRequest(
        id: string,
        decision: "approve" | "reject"
    ) {
        setReviewingId(id)

        try {
            const note = notes[id] ?? ""
            const result =
                decision === "approve"
                    ? await approveScheduleChange(id, note)
                    : await rejectScheduleChange(id, note)

            if (result.error) {
                window.alert(t(language, result.error))
            } else {
                router.refresh()
            }
        } catch {
            window.alert(
                t(
                    language,
                    "Could not review this schedule request. Please try again."
                )
            )
        } finally {
            setReviewingId(null)
        }
    }

    const dateFormatter = new Intl.DateTimeFormat(
        language === "ar" ? "ar-LB" : "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        }
    )

    return (
        <div dir={language === "ar" ? "rtl" : "ltr"} className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">
                    {t(language, "Schedule Requests")}
                </h1>
                <p className="mt-1 text-muted-foreground">
                    {t(language, "Review proposed weekly working hours.")}
                </p>
            </div>

            {requests.length === 0 ? (
                <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                    {t(language, "No pending schedule requests.")}
                </p>
            ) : (
                requests.map((request) => (
                    <Card key={request.id} className="bg-card/60">
                        <CardContent className="space-y-4 p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="font-semibold">
                                        {language === "ar"
                                            ? request.doctorNameAr ||
                                              request.doctorName
                                            : request.doctorName}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {request.specialty} ·{" "}
                                        {dateFormatter.format(
                                            new Date(request.requestedAt)
                                        )}
                                    </p>

                                    {request.reason && (
                                        <p className="mt-2 text-sm">
                                            {t(language, "Reason")}:{" "}
                                            {request.reason}
                                        </p>
                                    )}
                                </div>

                                <Badge variant="secondary">
                                    {t(language, "Pending")}
                                </Badge>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <ScheduleColumn
                                    title="Current hours"
                                    schedule={request.currentSchedule}
                                    language={language}
                                />
                                <ScheduleColumn
                                    title="Requested hours"
                                    schedule={request.requestedSchedule}
                                    language={language}
                                />
                            </div>

                            <div
                                className={`space-y-3 rounded-lg border p-3 ${
                                    request.conflicts.length > 0
                                        ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20"
                                        : "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="font-semibold">
                                        {t(language, "Affected appointments")}
                                    </h3>
                                    <Badge variant="secondary">
                                        {request.conflicts.length}
                                    </Badge>
                                </div>

                                {request.conflicts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        {t(
                                            language,
                                            "No existing appointments conflict with these hours."
                                        )}
                                    </p>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            {request.conflicts.map(
                                                (conflict) => (
                                                    <div
                                                        key={conflict.id}
                                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3"
                                                    >
                                                        <div>
                                                            <p className="font-medium">
                                                                {
                                                                    conflict.patientName
                                                                }
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {dateFormatter.format(
                                                                    new Date(
                                                                        `${conflict.date}T00:00:00Z`
                                                                    )
                                                                )}
                                                                {" · "}
                                                                <span dir="ltr">
                                                                    {
                                                                        conflict.time
                                                                    }
                                                                </span>
                                                            </p>
                                                        </div>

                                                        <Badge variant="secondary">
                                                            {t(
                                                                language,
                                                                conflict.status
                                                            )}
                                                        </Badge>
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                            {t(
                                                language,
                                                "Resolve affected appointments before approving this schedule."
                                            )}
                                        </p>
                                    </>
                                )}
                            </div>

                            <Textarea
                                value={notes[request.id] ?? ""}
                                onChange={(event) =>
                                    setNotes((current) => ({
                                        ...current,
                                        [request.id]: event.target.value,
                                    }))
                                }
                                maxLength={500}
                                rows={2}
                                placeholder={t(
                                    language,
                                    "Optional administrator note"
                                )}
                            />

                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={
                                        reviewingId === request.id ||
                                        !request.doctorExists
                                    }
                                    onClick={() =>
                                        reviewRequest(request.id, "reject")
                                    }
                                >
                                    {t(language, "Reject")}
                                </Button>

                                <Button
                                    type="button"
                                    disabled={
                                        reviewingId === request.id ||
                                        !request.doctorExists ||
                                        request.conflicts.length > 0
                                    }
                                    onClick={() =>
                                        reviewRequest(request.id, "approve")
                                    }
                                >
                                    {reviewingId === request.id && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    {t(language, "Approve")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    )
}